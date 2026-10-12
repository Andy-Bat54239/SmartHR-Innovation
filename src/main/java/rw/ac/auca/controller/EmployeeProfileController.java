package rw.ac.auca.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.employee_profile.domain.EmployeeProfile;
import rw.ac.auca.employee_profile.service.EmployeeProfileService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("employee-profile")
public class EmployeeProfileController {
    
    @Autowired
    private EmployeeProfileService employeeProfileService;

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    public EmployeeProfile createEmployeeProfile(@Valid @RequestBody EmployeeProfile employeeProfile){
        return employeeProfileService.saveProfile(employeeProfile);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public EmployeeProfile updateEmployeeProfile(@PathVariable UUID id, @Valid @RequestBody EmployeeProfile employeeProfile){
        employeeProfile.setId(id);
        return employeeProfileService.updateProfile(employeeProfile);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEmployeeProfile(@PathVariable UUID id){
        EmployeeProfile employeeProfile = new EmployeeProfile();
        employeeProfile.setId(id);

        employeeProfileService.delete(employeeProfile);
    }

    @GetMapping("/search-all")
    @ResponseStatus(HttpStatus.OK)
    public List<EmployeeProfile> findAllEmployeeProfiles(){
        return employeeProfileService.findAll();
    }

    @GetMapping("/search/{id}")
    @ResponseStatus(HttpStatus.OK)
    public EmployeeProfile findEmployeeProfileById(@PathVariable UUID id){
        EmployeeProfile employeeProfile = new EmployeeProfile();
        employeeProfile.setId(id);
        return employeeProfileService.findById(employeeProfile);
    }
}
