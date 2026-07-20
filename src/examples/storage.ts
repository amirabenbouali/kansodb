import { Database, DataType } from "../index.js";

const database = new Database();

database.createTable("employees", [
  {
    name: "id",
    type: DataType.INTEGER
  },
  {
    name: "name",
    type: DataType.TEXT
  },
  {
    name: "department",
    type: DataType.TEXT
  },
  {
    name: "salary",
    type: DataType.DECIMAL
  },
  {
    name: "active",
    type: DataType.BOOLEAN
  }
]);

const employees = database.getTable("employees");

employees.insert({
  id: 1,
  name: "Amira",
  department: "Engineering",
  salary: 48000,
  active: true
});

employees.insert({
  id: 2,
  name: "Maya",
  department: "Design",
  salary: 42000.5,
  active: true
});

console.table(employees.getRows());
