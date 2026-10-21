CREATE DATABASE HrisDb;
GO

USE HrisDb;
GO

CREATE TABLE Employees (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150) NOT NULL,
    Role NVARCHAR(100) NOT NULL,
    Department NVARCHAR(100) NOT NULL,
    Salary DECIMAL(10,2) NOT NULL,
    HireDate DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Active'
        CHECK (Status IN ('Active', 'On Leave', 'Resigned')),
    EmploymentType NVARCHAR(20) NOT NULL DEFAULT 'Full-time'
        CHECK (EmploymentType IN ('Full-time', 'Part-time', 'Contract'))
);
GO

-- Login accounts. Only password HASHES are stored, never plain-text passwords.
-- The API creates the demo user (admin@hris.com) on first start.
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(500) NOT NULL
);
GO

-- Sample employees so the dashboard has data to show
INSERT INTO Employees (Name, Email, Role, Department, Salary, HireDate, Status, EmploymentType) VALUES
('Fatima Al-Sayed', 'fatima.alsayed@company.com', 'HR Manager', 'Human Resources', 85000, '2019-03-11', 'Active', 'Full-time'),
('Omar Haddad', 'omar.haddad@company.com', 'Senior Software Engineer', 'Engineering', 125000, '2020-07-01', 'Active', 'Full-time'),
('Layla Mansour', 'layla.mansour@company.com', 'Marketing Specialist', 'Marketing', 62000, '2022-01-17', 'On Leave', 'Full-time'),
('Khalid Al-Rashid', 'khalid.alrashid@company.com', 'Sales Representative', 'Sales', 48000, '2021-02-22', 'Resigned', 'Contract'),
('Noor Khalil', 'noor.khalil@company.com', 'UX Designer', 'Engineering', 45000, '2024-09-02', 'Active', 'Part-time');
GO
