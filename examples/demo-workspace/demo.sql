CREATE TABLE offices (
  id INTEGER PRIMARY KEY,
  city TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  opened_year INTEGER NOT NULL,
  active BOOLEAN NOT NULL
);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  office_id INTEGER NOT NULL,
  active BOOLEAN NOT NULL,
  FOREIGN KEY (office_id) REFERENCES offices(id)
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL,
  region TEXT NOT NULL,
  active BOOLEAN NOT NULL
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department_id INTEGER NOT NULL,
  office_id INTEGER NOT NULL,
  salary DECIMAL NOT NULL,
  active BOOLEAN NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (office_id) REFERENCES offices(id)
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  budget DECIMAL NOT NULL,
  starts_on TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE employee_projects (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  allocation_percent INTEGER NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE project_assignments (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  planned_hours INTEGER NOT NULL,
  actual_hours INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  estimate_hours DECIMAL NOT NULL,
  completed BOOLEAN NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (owner_id) REFERENCES employees(id)
);

CREATE TABLE salaries (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  amount DECIMAL NOT NULL,
  paid_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

INSERT INTO offices VALUES (1, 'London', 'United Kingdom', 2017, TRUE);
INSERT INTO offices VALUES (2, 'New York', 'United States', 2019, TRUE);
INSERT INTO offices VALUES (3, 'Berlin', 'Germany', 2021, TRUE);
INSERT INTO offices VALUES (4, 'Toronto', 'Canada', 2023, TRUE);

INSERT INTO departments VALUES (1, 'Engineering', 1, TRUE);
INSERT INTO departments VALUES (2, 'Product', 1, TRUE);
INSERT INTO departments VALUES (3, 'Design', 1, TRUE);
INSERT INTO departments VALUES (4, 'Data', 2, TRUE);
INSERT INTO departments VALUES (5, 'Customer Success', 2, TRUE);
INSERT INTO departments VALUES (6, 'Sales', 3, TRUE);
INSERT INTO departments VALUES (7, 'Finance', 4, TRUE);
INSERT INTO departments VALUES (8, 'People Operations', 4, TRUE);

INSERT INTO clients VALUES (1, 'Northstar Retail', 'Retail', 'EMEA', TRUE);
INSERT INTO clients VALUES (2, 'Blue Harbor Bank', 'Financial Services', 'North America', TRUE);
INSERT INTO clients VALUES (3, 'Cedar Health', 'Healthcare', 'North America', TRUE);
INSERT INTO clients VALUES (4, 'BrightPath Logistics', 'Logistics', 'EMEA', TRUE);
INSERT INTO clients VALUES (5, 'Orbit Learning', 'Education', 'Global', TRUE);
INSERT INTO clients VALUES (6, 'GreenGrid Energy', 'Energy', 'EMEA', TRUE);
INSERT INTO clients VALUES (7, 'Juniper Foods', 'Food and Beverage', 'North America', TRUE);
INSERT INTO clients VALUES (8, 'Atlas Media', 'Media', 'Global', TRUE);
INSERT INTO clients VALUES (9, 'Summit Travel', 'Travel', 'EMEA', TRUE);
INSERT INTO clients VALUES (10, 'Clearwater Labs', 'Biotech', 'North America', TRUE);

INSERT INTO employees VALUES (1, 'amira.rahman@acme.test', 'Amira Rahman', 1, 1, 82000, TRUE);
INSERT INTO employees VALUES (2, 'maya.chen@acme.test', 'Maya Chen', 3, 1, 76000, TRUE);
INSERT INTO employees VALUES (3, 'noah.williams@acme.test', 'Noah Williams', 1, 1, 88000, TRUE);
INSERT INTO employees VALUES (4, 'lina.kovac@acme.test', 'Lina Kovac', 2, 1, 79000, TRUE);
INSERT INTO employees VALUES (5, 'sara.patel@acme.test', 'Sara Patel', 4, 2, 91000, TRUE);
INSERT INTO employees VALUES (6, 'eli.morgan@acme.test', 'Eli Morgan', 5, 2, 68000, TRUE);
INSERT INTO employees VALUES (7, 'zoe.carter@acme.test', 'Zoe Carter', 6, 3, 72000, TRUE);
INSERT INTO employees VALUES (8, 'omar.haddad@acme.test', 'Omar Haddad', 1, 3, 84000, TRUE);
INSERT INTO employees VALUES (9, 'ivy.nguyen@acme.test', 'Ivy Nguyen', 4, 2, 94000, TRUE);
INSERT INTO employees VALUES (10, 'leo.martin@acme.test', 'Leo Martin', 2, 1, 81000, TRUE);
INSERT INTO employees VALUES (11, 'nora.smith@acme.test', 'Nora Smith', 8, 4, 66000, TRUE);
INSERT INTO employees VALUES (12, 'samir.ali@acme.test', 'Samir Ali', 7, 4, 70000, TRUE);
INSERT INTO employees VALUES (13, 'tessa.brown@acme.test', 'Tessa Brown', 6, 3, 73500, TRUE);
INSERT INTO employees VALUES (14, 'kai.tanaka@acme.test', 'Kai Tanaka', 1, 1, 97000, TRUE);
INSERT INTO employees VALUES (15, 'mila.roberts@acme.test', 'Mila Roberts', 3, 1, 74500, TRUE);
INSERT INTO employees VALUES (16, 'ben.owens@acme.test', 'Ben Owens', 5, 2, 64000, TRUE);
INSERT INTO employees VALUES (17, 'elena.garcia@acme.test', 'Elena Garcia', 4, 2, 99000, TRUE);
INSERT INTO employees VALUES (18, 'jamal.reed@acme.test', 'Jamal Reed', 2, 1, 83000, TRUE);
INSERT INTO employees VALUES (19, 'priya.nair@acme.test', 'Priya Nair', 1, 3, 87500, TRUE);
INSERT INTO employees VALUES (20, 'marco.rossi@acme.test', 'Marco Rossi', 6, 3, 71000, TRUE);
INSERT INTO employees VALUES (21, 'ella.green@acme.test', 'Ella Green', 5, 2, 62500, TRUE);
INSERT INTO employees VALUES (22, 'jonas.weber@acme.test', 'Jonas Weber', 1, 3, 80500, TRUE);
INSERT INTO employees VALUES (23, 'fatima.khan@acme.test', 'Fatima Khan', 7, 4, 69500, TRUE);
INSERT INTO employees VALUES (24, 'ryan.clark@acme.test', 'Ryan Clark', 4, 2, 93000, TRUE);
INSERT INTO employees VALUES (25, 'hana.lee@acme.test', 'Hana Lee', 8, 4, 65000, TRUE);
INSERT INTO employees VALUES (26, 'mateo.silva@acme.test', 'Mateo Silva', 3, 1, 73500, TRUE);
INSERT INTO employees VALUES (27, 'aisha.okafor@acme.test', 'Aisha Okafor', 2, 1, 82000, TRUE);
INSERT INTO employees VALUES (28, 'tom.evans@acme.test', 'Tom Evans', 5, 2, 61500, TRUE);
INSERT INTO employees VALUES (29, 'sofia.rivera@acme.test', 'Sofia Rivera', 6, 3, 74500, TRUE);
INSERT INTO employees VALUES (30, 'daniel.kim@acme.test', 'Daniel Kim', 1, 1, 89500, TRUE);

INSERT INTO projects VALUES (1, 1, 'Retail Analytics Portal', 'active', 185000, '2026-01-15');
INSERT INTO projects VALUES (2, 2, 'Loan Review Automation', 'active', 240000, '2026-02-01');
INSERT INTO projects VALUES (3, 3, 'Care Coordination Dashboard', 'active', 210000, '2026-02-12');
INSERT INTO projects VALUES (4, 4, 'Fleet Route Optimizer', 'planning', 160000, '2026-03-01');
INSERT INTO projects VALUES (5, 5, 'Learning Insights Hub', 'active', 135000, '2026-01-22');
INSERT INTO projects VALUES (6, 6, 'Energy Demand Forecast', 'active', 260000, '2026-02-20');
INSERT INTO projects VALUES (7, 7, 'Supply Chain Console', 'maintenance', 125000, '2025-11-15');
INSERT INTO projects VALUES (8, 8, 'Audience Segmentation', 'active', 175000, '2026-03-08');
INSERT INTO projects VALUES (9, 9, 'Travel Ops Workspace', 'planning', 150000, '2026-04-01');
INSERT INTO projects VALUES (10, 10, 'Lab Inventory System', 'active', 195000, '2026-01-30');
INSERT INTO projects VALUES (11, 2, 'Risk Reporting Refresh', 'maintenance', 98000, '2025-10-10');
INSERT INTO projects VALUES (12, 1, 'Store Manager Mobile', 'active', 145000, '2026-03-18');

INSERT INTO employee_projects VALUES (1, 1, 1, 'Tech Lead', 60);
INSERT INTO employee_projects VALUES (2, 2, 1, 'Product Designer', 40);
INSERT INTO employee_projects VALUES (3, 4, 1, 'Product Manager', 50);
INSERT INTO employee_projects VALUES (4, 5, 2, 'Data Lead', 70);
INSERT INTO employee_projects VALUES (5, 9, 2, 'Analytics Engineer', 60);
INSERT INTO employee_projects VALUES (6, 14, 2, 'Backend Engineer', 50);
INSERT INTO employee_projects VALUES (7, 17, 3, 'Data Scientist', 60);
INSERT INTO employee_projects VALUES (8, 18, 3, 'Product Manager', 40);
INSERT INTO employee_projects VALUES (9, 3, 3, 'Frontend Engineer', 50);
INSERT INTO employee_projects VALUES (10, 8, 4, 'Backend Engineer', 45);
INSERT INTO employee_projects VALUES (11, 20, 4, 'Account Executive', 30);
INSERT INTO employee_projects VALUES (12, 6, 5, 'Customer Lead', 45);
INSERT INTO employee_projects VALUES (13, 15, 5, 'Designer', 55);
INSERT INTO employee_projects VALUES (14, 24, 6, 'Data Engineer', 70);
INSERT INTO employee_projects VALUES (15, 19, 6, 'Platform Engineer', 50);
INSERT INTO employee_projects VALUES (16, 21, 7, 'Support Specialist', 35);
INSERT INTO employee_projects VALUES (17, 7, 8, 'Sales Lead', 40);
INSERT INTO employee_projects VALUES (18, 10, 8, 'Product Manager', 45);
INSERT INTO employee_projects VALUES (19, 22, 9, 'Engineer', 35);
INSERT INTO employee_projects VALUES (20, 13, 9, 'Sales Lead', 30);
INSERT INTO employee_projects VALUES (21, 30, 10, 'Backend Engineer', 55);
INSERT INTO employee_projects VALUES (22, 23, 10, 'Finance Partner', 25);
INSERT INTO employee_projects VALUES (23, 12, 11, 'Finance Lead', 30);
INSERT INTO employee_projects VALUES (24, 27, 12, 'Product Manager', 45);
INSERT INTO employee_projects VALUES (25, 26, 12, 'Designer', 35);

INSERT INTO project_assignments VALUES (1, 1, 1, 820, 760);
INSERT INTO project_assignments VALUES (2, 1, 3, 320, 290);
INSERT INTO project_assignments VALUES (3, 2, 4, 900, 840);
INSERT INTO project_assignments VALUES (4, 2, 1, 450, 420);
INSERT INTO project_assignments VALUES (5, 3, 4, 720, 680);
INSERT INTO project_assignments VALUES (6, 3, 2, 310, 275);
INSERT INTO project_assignments VALUES (7, 4, 1, 520, 140);
INSERT INTO project_assignments VALUES (8, 4, 6, 180, 60);
INSERT INTO project_assignments VALUES (9, 5, 5, 360, 330);
INSERT INTO project_assignments VALUES (10, 5, 3, 420, 390);
INSERT INTO project_assignments VALUES (11, 6, 4, 980, 910);
INSERT INTO project_assignments VALUES (12, 6, 1, 460, 430);
INSERT INTO project_assignments VALUES (13, 7, 5, 260, 240);
INSERT INTO project_assignments VALUES (14, 8, 6, 310, 250);
INSERT INTO project_assignments VALUES (15, 8, 2, 390, 355);
INSERT INTO project_assignments VALUES (16, 9, 1, 340, 90);
INSERT INTO project_assignments VALUES (17, 10, 1, 560, 500);
INSERT INTO project_assignments VALUES (18, 10, 7, 160, 120);
INSERT INTO project_assignments VALUES (19, 11, 7, 220, 210);
INSERT INTO project_assignments VALUES (20, 12, 2, 440, 210);
INSERT INTO project_assignments VALUES (21, 12, 3, 280, 130);

INSERT INTO tasks VALUES (1, 1, 1, 'Design revenue overview query', 'done', 6, TRUE);
INSERT INTO tasks VALUES (2, 1, 2, 'Polish dashboard empty states', 'done', 8, TRUE);
INSERT INTO tasks VALUES (3, 1, 3, 'Implement store comparison API', 'in_progress', 13, FALSE);
INSERT INTO tasks VALUES (4, 1, 4, 'Review merchandising workflow', 'done', 5, TRUE);
INSERT INTO tasks VALUES (5, 1, 14, 'Optimize customer segment scan', 'todo', 9, FALSE);
INSERT INTO tasks VALUES (6, 2, 5, 'Model loan review features', 'done', 10, TRUE);
INSERT INTO tasks VALUES (7, 2, 9, 'Validate risk scoring output', 'in_progress', 11, FALSE);
INSERT INTO tasks VALUES (8, 2, 14, 'Build exception queue service', 'done', 14, TRUE);
INSERT INTO tasks VALUES (9, 2, 17, 'Tune approval threshold report', 'todo', 7, FALSE);
INSERT INTO tasks VALUES (10, 2, 24, 'Document analytics lineage', 'done', 4, TRUE);
INSERT INTO tasks VALUES (11, 3, 17, 'Create patient cohort aggregate', 'done', 12, TRUE);
INSERT INTO tasks VALUES (12, 3, 18, 'Clarify care team workflow', 'done', 5, TRUE);
INSERT INTO tasks VALUES (13, 3, 3, 'Ship appointment timeline view', 'in_progress', 16, FALSE);
INSERT INTO tasks VALUES (14, 3, 5, 'Validate dashboard metrics', 'todo', 8, FALSE);
INSERT INTO tasks VALUES (15, 3, 15, 'Accessibility pass for charts', 'todo', 6, FALSE);
INSERT INTO tasks VALUES (16, 4, 8, 'Prototype routing constraints', 'in_progress', 12, FALSE);
INSERT INTO tasks VALUES (17, 4, 20, 'Map dispatch stakeholder notes', 'done', 4, TRUE);
INSERT INTO tasks VALUES (18, 4, 22, 'Prepare fleet telemetry loader', 'todo', 10, FALSE);
INSERT INTO tasks VALUES (19, 4, 29, 'Draft expansion account plan', 'todo', 5, FALSE);
INSERT INTO tasks VALUES (20, 5, 6, 'Write onboarding success playbook', 'done', 6, TRUE);
INSERT INTO tasks VALUES (21, 5, 15, 'Design lesson analytics cards', 'in_progress', 9, FALSE);
INSERT INTO tasks VALUES (22, 5, 16, 'Audit support response labels', 'done', 3, TRUE);
INSERT INTO tasks VALUES (23, 5, 26, 'Prototype educator insight panel', 'todo', 8, FALSE);
INSERT INTO tasks VALUES (24, 6, 24, 'Train demand forecast baseline', 'done', 15, TRUE);
INSERT INTO tasks VALUES (25, 6, 19, 'Build ingestion retry monitor', 'in_progress', 10, FALSE);
INSERT INTO tasks VALUES (26, 6, 17, 'Compare seasonal forecast error', 'todo', 9, FALSE);
INSERT INTO tasks VALUES (27, 6, 30, 'Create usage anomaly query', 'done', 7, TRUE);
INSERT INTO tasks VALUES (28, 7, 21, 'Resolve priority supplier tickets', 'done', 6, TRUE);
INSERT INTO tasks VALUES (29, 7, 6, 'Refresh onboarding checklist', 'todo', 3, FALSE);
INSERT INTO tasks VALUES (30, 7, 28, 'Summarize monthly support volume', 'done', 4, TRUE);
INSERT INTO tasks VALUES (31, 8, 7, 'Draft media launch sequence', 'todo', 5, FALSE);
INSERT INTO tasks VALUES (32, 8, 10, 'Define audience cohort logic', 'done', 6, TRUE);
INSERT INTO tasks VALUES (33, 8, 13, 'Review agency renewal plan', 'in_progress', 4, FALSE);
INSERT INTO tasks VALUES (34, 8, 18, 'Package campaign results brief', 'todo', 6, FALSE);
INSERT INTO tasks VALUES (35, 9, 22, 'Create travel ops data model', 'todo', 12, FALSE);
INSERT INTO tasks VALUES (36, 9, 29, 'Plan regional rollout pipeline', 'todo', 5, FALSE);
INSERT INTO tasks VALUES (37, 9, 11, 'Staff beta support rotation', 'todo', 4, FALSE);
INSERT INTO tasks VALUES (38, 10, 30, 'Implement inventory count import', 'done', 11, TRUE);
INSERT INTO tasks VALUES (39, 10, 23, 'Review procurement budget logic', 'done', 5, TRUE);
INSERT INTO tasks VALUES (40, 10, 1, 'Patch reagent location lookup', 'in_progress', 8, FALSE);
INSERT INTO tasks VALUES (41, 10, 8, 'Add lab item validation rules', 'todo', 9, FALSE);
INSERT INTO tasks VALUES (42, 11, 12, 'Reconcile report templates', 'done', 4, TRUE);
INSERT INTO tasks VALUES (43, 11, 5, 'Audit risk report calculations', 'todo', 6, FALSE);
INSERT INTO tasks VALUES (44, 11, 14, 'Retire legacy report endpoint', 'in_progress', 7, FALSE);
INSERT INTO tasks VALUES (45, 12, 27, 'Finalize mobile manager scope', 'done', 5, TRUE);
INSERT INTO tasks VALUES (46, 12, 26, 'Design inventory exception flow', 'in_progress', 8, FALSE);
INSERT INTO tasks VALUES (47, 12, 3, 'Build store task sync', 'todo', 13, FALSE);
INSERT INTO tasks VALUES (48, 12, 2, 'Polish mobile navigation states', 'todo', 6, FALSE);
INSERT INTO tasks VALUES (49, 6, 9, 'Publish forecast accuracy summary', 'done', 4, TRUE);
INSERT INTO tasks VALUES (50, 3, 24, 'Investigate readmission signal drift', 'todo', 9, FALSE);
INSERT INTO tasks VALUES (51, 2, 1, 'Review bank data retention notes', 'todo', 4, FALSE);
INSERT INTO tasks VALUES (52, 4, 8, 'Benchmark route optimizer query', 'done', 7, TRUE);
INSERT INTO tasks VALUES (53, 5, 4, 'Align product launch checklist', 'done', 3, TRUE);
INSERT INTO tasks VALUES (54, 7, 21, 'Prepare support handoff summary', 'todo', 3, FALSE);
INSERT INTO tasks VALUES (55, 8, 20, 'Update media account forecast', 'done', 4, TRUE);
INSERT INTO tasks VALUES (56, 9, 13, 'Qualify travel pilot sponsors', 'todo', 5, FALSE);
INSERT INTO tasks VALUES (57, 10, 17, 'Validate lab inventory snapshots', 'done', 6, TRUE);
INSERT INTO tasks VALUES (58, 12, 10, 'Plan manager training rollout', 'todo', 4, FALSE);
INSERT INTO tasks VALUES (59, 1, 27, 'Prioritize store manager feedback', 'in_progress', 5, FALSE);
INSERT INTO tasks VALUES (60, 6, 19, 'Reduce forecast refresh latency', 'todo', 10, FALSE);

INSERT INTO salaries VALUES (1, 1, 82000, '2026-01-31');
INSERT INTO salaries VALUES (2, 2, 76000, '2026-01-31');
INSERT INTO salaries VALUES (3, 3, 88000, '2026-01-31');
INSERT INTO salaries VALUES (4, 4, 79000, '2026-01-31');
INSERT INTO salaries VALUES (5, 5, 91000, '2026-01-31');
INSERT INTO salaries VALUES (6, 6, 68000, '2026-01-31');
INSERT INTO salaries VALUES (7, 7, 72000, '2026-01-31');
INSERT INTO salaries VALUES (8, 8, 84000, '2026-01-31');
INSERT INTO salaries VALUES (9, 9, 94000, '2026-01-31');
INSERT INTO salaries VALUES (10, 10, 81000, '2026-01-31');
INSERT INTO salaries VALUES (11, 11, 66000, '2026-01-31');
INSERT INTO salaries VALUES (12, 12, 70000, '2026-01-31');
INSERT INTO salaries VALUES (13, 13, 73500, '2026-01-31');
INSERT INTO salaries VALUES (14, 14, 97000, '2026-01-31');
INSERT INTO salaries VALUES (15, 15, 74500, '2026-01-31');
INSERT INTO salaries VALUES (16, 16, 64000, '2026-01-31');
INSERT INTO salaries VALUES (17, 17, 99000, '2026-01-31');
INSERT INTO salaries VALUES (18, 18, 83000, '2026-01-31');
INSERT INTO salaries VALUES (19, 19, 87500, '2026-01-31');
INSERT INTO salaries VALUES (20, 20, 71000, '2026-01-31');
INSERT INTO salaries VALUES (21, 21, 62500, '2026-01-31');
INSERT INTO salaries VALUES (22, 22, 80500, '2026-01-31');
INSERT INTO salaries VALUES (23, 23, 69500, '2026-01-31');
INSERT INTO salaries VALUES (24, 24, 93000, '2026-01-31');
INSERT INTO salaries VALUES (25, 25, 65000, '2026-01-31');
INSERT INTO salaries VALUES (26, 26, 73500, '2026-01-31');
INSERT INTO salaries VALUES (27, 27, 82000, '2026-01-31');
INSERT INTO salaries VALUES (28, 28, 61500, '2026-01-31');
INSERT INTO salaries VALUES (29, 29, 74500, '2026-01-31');
INSERT INTO salaries VALUES (30, 30, 89500, '2026-01-31');

INSERT INTO audit_log VALUES (1, 1, 'created demo workspace', '2026-07-01');
INSERT INTO audit_log VALUES (2, 5, 'refreshed analytics extract', '2026-07-03');
INSERT INTO audit_log VALUES (3, 12, 'approved finance dashboard', '2026-07-05');
INSERT INTO audit_log VALUES (4, NULL, 'nightly maintenance completed', '2026-07-07');
INSERT INTO audit_log VALUES (5, 24, 'reviewed forecast results', '2026-07-09');
