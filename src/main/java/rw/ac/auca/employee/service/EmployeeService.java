package rw.ac.auca.employee.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.employee.domain.Gender;
import rw.ac.auca.location.domain.Location;

import java.util.List;
import java.util.UUID;

public interface EmployeeService {
    Employee registerEmployee(Employee employee);
    Employee updateEmployee(Employee employee);
    void deleteEmployee(Employee employee);
    Employee findEmployeeById(Employee employee);
    List<Employee> findAllEmployees();

    /** One page of employees matching every filter that is set (see {@link EmployeeFilter}). */
    Page<Employee> searchEmployees(EmployeeFilter filter, Pageable pageable);

    Page<Employee> findEmployeesByDepartment(UUID departmentId, Pageable pageable);
    List<Employee> findEmployeesByStatus(EmployeeStatus status);
    List<Employee> findEmployeesByGender(Gender gender);

    /** Employees living anywhere under the province (district, sector, cell or village). */
    List<Employee> findEmployeesByProvinceId(UUID provinceId);
    List<Employee> findEmployeesByProvinceCode(String code);
    List<Employee> findEmployeesByProvinceName(String name);

    /** The province an employee lives in, found by walking up the location tree. */
    Location findProvinceOfEmployee(UUID employeeId);

    /** [Province, District, Sector, Cell, Village] down to the employee's own location. */
    List<Location> findLocationPath(UUID employeeId);
}
