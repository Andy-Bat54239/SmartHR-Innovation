package rw.ac.auca.department.service;

import rw.ac.auca.department.domain.Department;

import java.util.List;

public interface DepartmentService {
    Department registerDepartment(Department department);
    Department updateDepartment(Department department);
    void deleteDepartment (Department department);
    Department findDepartmentById(Department department);
    List<Department> findAllDepartments();
}
