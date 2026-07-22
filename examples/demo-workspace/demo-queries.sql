-- KansoDB Sample Workspace
-- Acme Corporation sample data with offices, departments, employees, clients, projects, assignments, tasks, salaries, and audit events.
-- Copy individual statements into the KansoDB Workbench; comments are documentation.

-- Basic Queries
-- Basic select
SELECT name, salary
FROM employees
ORDER BY name ASC
LIMIT 8;

-- Active projects
SELECT name, status, budget
FROM projects
WHERE status = 'active'
ORDER BY budget DESC
LIMIT 6;

-- Insert audit event
INSERT INTO audit_log VALUES (6, 1, 'demo query executed', '2026-07-22');

-- Update task status
UPDATE tasks
SET status = 'done', completed = TRUE
WHERE id = 60;

-- Delete audit event
DELETE FROM audit_log
WHERE id = 6;

-- Filtering
-- High salaries
SELECT name, salary
FROM employees
WHERE salary >= 90000
ORDER BY salary DESC;

-- Open tasks
SELECT title, status, estimate_hours
FROM tasks
WHERE completed = FALSE
ORDER BY estimate_hours DESC
LIMIT 10;

-- Sorting
-- Largest budgets
SELECT name, budget, status
FROM projects
ORDER BY budget DESC
LIMIT 5;

-- Aggregates
-- Department payroll
SELECT department_id, COUNT(*) AS employees, AVG(salary) AS average_salary, SUM(salary) AS payroll
FROM employees
GROUP BY department_id
ORDER BY payroll DESC;

-- Project task load
SELECT project_id, COUNT(*) AS tasks, SUM(estimate_hours) AS estimated_hours
FROM tasks
GROUP BY project_id
ORDER BY estimated_hours DESC
LIMIT 8;

-- Joins
-- Employees by department
SELECT e.name, d.name AS department, o.city AS office
FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN offices o ON e.office_id = o.id
ORDER BY e.name ASC
LIMIT 12;

-- Projects and clients
SELECT p.name AS project, c.name AS client, p.budget
FROM projects p
INNER JOIN clients c ON p.client_id = c.id
ORDER BY p.budget DESC
LIMIT 8;

-- Transactions
-- Transaction commit
BEGIN;
UPDATE projects SET budget = budget + 5000 WHERE id = 4;
INSERT INTO audit_log VALUES (7, 4, 'approved route optimizer change budget', '2026-07-22');
COMMIT;

-- Rollback salary change
BEGIN;
UPDATE employees SET salary = 1 WHERE name = 'Amira Rahman';
ROLLBACK;
SELECT name, salary FROM employees WHERE name = 'Amira Rahman';

-- Constraints
-- Foreign key violation (intentional error)
INSERT INTO tasks VALUES (101, 999, 1, 'Link task to missing project', 'todo', 2, FALSE);

-- Unique constraint violation (intentional error)
INSERT INTO employees VALUES (31, 'amira.rahman@acme.test', 'Amira Duplicate', 1, 1, 82000, TRUE);
