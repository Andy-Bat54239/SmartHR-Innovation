package rw.ac.auca.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.department.service.DepartmentService;
import rw.ac.auca.department.domain.Department;
import rw.ac.auca.department.service.DepartmentService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("department")
public class DepartmentController {
    @Autowired
    private DepartmentService departmentService;

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    public Department createDepartment(@Valid @RequestBody Department department){
        return departmentService.registerDepartment(department);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Department updateDepartment(@PathVariable UUID id, @Valid @RequestBody Department department){
        department.setId(id);
        return departmentService.updateDepartment(department);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDepartment(@PathVariable UUID id){
        Department department = new Department();
        department.setId(id);

        departmentService.deleteDepartment(department);
    }

    @GetMapping("/search-all")
    @ResponseStatus(HttpStatus.OK)
    public List<Department> findAllDepartments(){
        return departmentService.findAllDepartments();
    }

    @GetMapping("/search/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Department findDepartmentById(@PathVariable UUID id){
        Department department = new Department();
        department.setId(id);
        return departmentService.findDepartmentById(department);
    }
}
