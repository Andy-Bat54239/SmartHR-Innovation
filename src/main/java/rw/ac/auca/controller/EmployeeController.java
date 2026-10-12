package rw.ac.auca.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.base.PageRequests;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.employee.domain.Gender;
import rw.ac.auca.employee.service.EmployeeFilter;
import rw.ac.auca.employee.service.EmployeeService;
import rw.ac.auca.location.domain.Location;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/employee")
public class EmployeeController {

    private static final Set<String> SORT_FIELDS =
            Set.of("id", "firstName", "lastName", "email", "hireDate", "status", "gender", "createdAt");

    @Autowired
    private EmployeeService employeeService;

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    public Employee createEmployee(@Valid @RequestBody Employee employee){
        return employeeService.registerEmployee(employee);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Employee updateEmployee(@PathVariable UUID id, @Valid @RequestBody Employee employee){
        employee.setId(id);
        return employeeService.updateEmployee(employee);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEmployee(@PathVariable UUID id){
        Employee employee = new Employee();
        employee.setId(id);

        employeeService.deleteEmployee(employee);
    }

    // Everything at once: meant for dropdowns and small lists
    @GetMapping("/search-all")
    @ResponseStatus(HttpStatus.OK)
    public List<Employee> findAllEmployees(){
        return employeeService.findAllEmployees();
    }

    // One page at a time: meant for tables. ?page=0&size=10&sortBy=lastName&direction=asc
    // Optional filters, combined with AND: q (name / email / phone text), status, gender, departmentId, provinceId
    @GetMapping("/search-page")
    @ResponseStatus(HttpStatus.OK)
    public Page<Employee> findEmployeesPage(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "10") int size,
                                            @RequestParam(defaultValue = "createdAt") String sortBy,
                                            @RequestParam(defaultValue = "asc") String direction,
                                            @RequestParam(required = false) String q,
                                            @RequestParam(required = false) EmployeeStatus status,
                                            @RequestParam(required = false) Gender gender,
                                            @RequestParam(required = false) UUID departmentId,
                                            @RequestParam(required = false) UUID provinceId){
        return employeeService.searchEmployees(
                new EmployeeFilter(q, status, gender, departmentId, provinceId),
                PageRequests.of(page, size, sortBy, direction, SORT_FIELDS));
    }

    @GetMapping("/search/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Employee findEmployeeById(@PathVariable UUID id){
        Employee employee = new Employee();
        employee.setId(id);
        return employeeService.findEmployeeById(employee);
    }

    @GetMapping("/department/{departmentId}")
    @ResponseStatus(HttpStatus.OK)
    public Page<Employee> findByDepartment(@PathVariable UUID departmentId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "10") int size,
                                           @RequestParam(defaultValue = "createdAt") String sortBy,
                                           @RequestParam(defaultValue = "asc") String direction){
        return employeeService.findEmployeesByDepartment(departmentId,
                PageRequests.of(page, size, sortBy, direction, SORT_FIELDS));
    }

    @GetMapping("/status/{status}")
    @ResponseStatus(HttpStatus.OK)
    public List<Employee> findByStatus(@PathVariable EmployeeStatus status){
        return employeeService.findEmployeesByStatus(status);
    }

    @GetMapping("/gender/{gender}")
    @ResponseStatus(HttpStatus.OK)
    public List<Employee> findByGender(@PathVariable Gender gender){
        return employeeService.findEmployeesByGender(gender);
    }

    @GetMapping("/province/{provinceId}")
    @ResponseStatus(HttpStatus.OK)
    public List<Employee> findByProvinceId(@PathVariable UUID provinceId){
        return employeeService.findEmployeesByProvinceId(provinceId);
    }

    @GetMapping("/province/code/{code}")
    @ResponseStatus(HttpStatus.OK)
    public List<Employee> findByProvinceCode(@PathVariable String code){
        return employeeService.findEmployeesByProvinceCode(code);
    }

    @GetMapping("/province/name/{name}")
    @ResponseStatus(HttpStatus.OK)
    public List<Employee> findByProvinceName(@PathVariable String name){
        return employeeService.findEmployeesByProvinceName(name);
    }

    @GetMapping("/{id}/province")
    @ResponseStatus(HttpStatus.OK)
    public Location findProvinceOfEmployee(@PathVariable UUID id){
        return employeeService.findProvinceOfEmployee(id);
    }

    @GetMapping("/{id}/location")
    @ResponseStatus(HttpStatus.OK)
    public List<Location> findLocationPath(@PathVariable UUID id){
        return employeeService.findLocationPath(id);
    }
}
