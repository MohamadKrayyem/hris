using System.Net.Mail;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddUserSecrets<Program>(); // Load user-secrets even outside "Development" (we have no launchSettings.json)

// Database connection. Online hosting sets it with the environment variable ConnectionStrings__Hris.
// Locally we fall back to SQL Express with Windows login, so there is no password in the code.
var connectionString = builder.Configuration.GetConnectionString("Hris")
    ?? "Server=localhost\\SQLEXPRESS;Database=HrisDb;Trusted_Connection=True;TrustServerCertificate=True;";

// The JWT signing key comes from user-secrets (online: the Jwt__Key environment variable), never from the code
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrEmpty(jwtKey))
    throw new InvalidOperationException("Jwt:Key is missing. Run: dotnet user-secrets set Jwt:Key <your-key>");
if (jwtKey.Length < 32) // HMAC-SHA256 needs a key of at least 256 bits; a short key is easy to guess
    throw new InvalidOperationException("Jwt:Key is too short. Use at least 32 characters (64 recommended).");
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

// Only our frontend may call the API from a browser (online: set Cors__Origin to the website address)
var corsOrigin = builder.Configuration["Cors:Origin"] ?? "http://localhost:5173";
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(corsOrigin)                         // Only this website, not every website
    .WithMethods("GET", "POST", "PUT", "DELETE")     // Only the methods the app uses
    .WithHeaders("Content-Type", "Authorization"))); // Only the headers the app sends

// Limit each request body to 1 MB, so nobody can slow the server down with huge requests
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1024 * 1024);

// Brute-force protection: at most 5 login attempts per minute from the same IP address
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown", // One counter per IP
        factory: _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    // What the 6th attempt gets back: 429 Too Many Requests with a clear message
    options.OnRejected = async (rejected, cancel) =>
    {
        rejected.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await rejected.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many login attempts. Try again in a minute." }, cancel);
    };
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Every request's token is checked: right issuer/audience, not expired, and signed with OUR key
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "HrisApi",
            ValidAudience = "HrisApi",
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.Zero // Expired means expired (no extra 5 minutes)
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// Hide error details: stack traces and SQL errors only go to the server log, never to the browser
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new { error = "Something went wrong" });
}));

// HTTPS for the online version only. Locally there is no HTTPS port, so these do nothing
// and http://localhost:5000 keeps working.
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();             // Tells browsers: always use HTTPS for this site
    app.UseHttpsRedirection(); // Sends http:// requests to https://
}

// Security headers on every response (added just before the response is sent, so error responses get them too)
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff"; // The browser must not guess the content type
        headers["X-Frame-Options"] = "DENY";           // Nobody may show the API inside a frame (clickjacking)
        headers["Referrer-Policy"] = "no-referrer";    // Don't send our URLs to other sites
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"; // The API only returns JSON: load nothing
        return Task.CompletedTask;
    });
    await next();
});

app.UseCors();
app.UseRateLimiter();    // Applies the "login" limit above
app.UseAuthentication(); // Reads the token and works out who the user is
app.UseAuthorization();  // Then blocks routes that require a logged-in user

var hasher = new PasswordHasher<User>(); // Hashes passwords with PBKDF2 and a random salt (never plain text)
var dummyHash = hasher.HashPassword(null!, "dummy-password"); // Used for unknown emails (the user argument is not used)

// Demo account for the portfolio: admin@hris.com / Admin123!  (only the hash is saved)
using (var db = new SqlConnection(connectionString))
{
    if (db.ExecuteScalar<int>("SELECT COUNT(*) FROM Users") == 0)
    {
        var admin = new User(0, "Admin", "admin@hris.com", "");
        db.Execute("INSERT INTO Users (Name, Email, PasswordHash) VALUES (@Name, @Email, @PasswordHash)",
            admin with { PasswordHash = hasher.HashPassword(admin, "Admin123!") });
    }
}

// Log in: check email + password, then return a signed token (public route, but rate-limited)
app.MapPost("/login", async (LoginRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrEmpty(req.Password))
        return Results.BadRequest(new { error = "Email and password are required." });
    if (req.Email.Length > 150 || req.Password.Length > 100) // Never valid, and very long passwords are slow to hash
        return Results.BadRequest(new { error = "Email or password is too long." });

    using var db = new SqlConnection(connectionString);
    var user = await db.QuerySingleOrDefaultAsync<User>(
        "SELECT Id, Name, Email, PasswordHash FROM Users WHERE Email = @Email", // @Email = parameter, no SQL injection
        new { Email = req.Email.Trim() });

    // Always run the hash check (with a fake hash if the email is unknown) so both cases take the same time
    var result = hasher.VerifyHashedPassword(user!, user?.PasswordHash ?? dummyHash, req.Password);

    // Same message for "no such email" and "wrong password", so attackers can't tell which emails exist
    if (user == null || result == PasswordVerificationResult.Failed)
        return Results.Json(new { error = "Invalid email or password" }, statusCode: 401);

    var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity([
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Name, user.Name),
        ]),
        Issuer = "HrisApi",
        Audience = "HrisApi",
        Expires = DateTime.UtcNow.AddHours(2),
        SigningCredentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256) // Signed, so it can't be faked
    });
    return Results.Ok(new { token, name = user.Name, email = user.Email });
}).RequireRateLimiting("login"); // Max 5 attempts per minute per IP

// All employee routes need a valid token, otherwise the API answers 401
var employees = app.MapGroup("/employees").RequireAuthorization();

// Get all employees
employees.MapGet("/", async () =>
{
    using var db = new SqlConnection(connectionString);
    return await db.QueryAsync<Employee>(
        "SELECT Id, Name, Email, Role, Department, Salary, HireDate, Status, EmploymentType FROM Employees");
});

// Add a new employee and return it with its new Id
employees.MapPost("/", async (Employee emp) =>
{
    emp = Trimmed(emp);
    var error = Validate(emp);
    if (error != null) return Results.BadRequest(new { error });

    using var db = new SqlConnection(connectionString);
    var id = await db.ExecuteScalarAsync<int>(
        @"INSERT INTO Employees (Name, Email, Role, Department, Salary, HireDate, Status, EmploymentType)
          OUTPUT INSERTED.Id
          VALUES (@Name, @Email, @Role, @Department, @Salary, @HireDate, @Status, @EmploymentType)",
        emp); // Dapper fills @Name, @Email... from the emp properties (parameters, never string concatenation)
    return Results.Ok(emp with { Id = id });
});

// Update an existing employee by Id
employees.MapPut("/{id}", async (int id, Employee emp) =>
{
    emp = Trimmed(emp);
    var error = Validate(emp);
    if (error != null) return Results.BadRequest(new { error });

    using var db = new SqlConnection(connectionString);
    var rows = await db.ExecuteAsync(
        @"UPDATE Employees
          SET Name = @Name, Email = @Email, Role = @Role, Department = @Department, Salary = @Salary,
              HireDate = @HireDate, Status = @Status, EmploymentType = @EmploymentType
          WHERE Id = @Id",
        emp with { Id = id }); // Use the Id from the URL
    return rows == 0 ? Results.NotFound() : Results.NoContent(); // 0 rows = no employee with that Id
});

// Delete an employee by Id
employees.MapDelete("/{id}", async (int id) =>
{
    using var db = new SqlConnection(connectionString);
    var rows = await db.ExecuteAsync("DELETE FROM Employees WHERE Id = @id", new { id });
    return rows == 0 ? Results.NotFound() : Results.NoContent();
});

app.Run();

// Removes spaces at the start and end of the text fields (a missing field becomes "")
static Employee Trimmed(Employee e) => e with
{
    Name = e.Name?.Trim() ?? "",
    Email = e.Email?.Trim() ?? "",
    Role = e.Role?.Trim() ?? "",
    Department = e.Department?.Trim() ?? "",
    Status = e.Status?.Trim() ?? "",
    EmploymentType = e.EmploymentType?.Trim() ?? "",
};

// Checks an employee before saving. Returns an error message, or null if everything is valid.
// Never trust the browser: these checks run on the server even though the form checks too.
static string? Validate(Employee e)
{
    if (string.IsNullOrWhiteSpace(e.Name) || string.IsNullOrWhiteSpace(e.Email) ||
        string.IsNullOrWhiteSpace(e.Role) || string.IsNullOrWhiteSpace(e.Department))
        return "Name, email, role and department are required.";
    // Max lengths match the database columns
    if (e.Name.Length > 100 || e.Role.Length > 100 || e.Department.Length > 100)
        return "Name, role and department must be 100 characters or less.";
    if (e.Email.Length > 150)
        return "Email must be 150 characters or less.";
    // TryCreate also accepts "Name <a@b.com>", so we also check that the result is just the address
    if (!MailAddress.TryCreate(e.Email, out var mail) || mail.Address != e.Email)
        return "Email is not valid.";
    if (e.Salary < 0 || e.Salary > 10_000_000)
        return "Salary must be between 0 and 10,000,000.";
    if (e.HireDate.Date > DateTime.Today)
        return "Hire date cannot be in the future.";
    if (e.HireDate.Year < 1950)
        return "Hire date cannot be before 1950.";
    if (!new[] { "Active", "On Leave", "Resigned" }.Contains(e.Status))
        return "Status must be Active, On Leave or Resigned.";
    if (!new[] { "Full-time", "Part-time", "Contract" }.Contains(e.EmploymentType))
        return "Employment type must be Full-time, Part-time or Contract.";
    return null;
}

// The shape of one employee row (also used for JSON in/out)
record Employee(int Id, string Name, string Email, string Role, string Department,
                decimal Salary, DateTime HireDate, string Status, string EmploymentType);

// The body of POST /login
record LoginRequest(string Email, string Password);

// One row of the Users table
record User(int Id, string Name, string Email, string PasswordHash);
