package rw.ac.auca.employee_profile.service;

import rw.ac.auca.employee_profile.domain.EmployeeProfile;

import java.util.List;

public interface EmployeeProfileService {
    EmployeeProfile saveProfile(EmployeeProfile employeeProfile);
    EmployeeProfile updateProfile(EmployeeProfile employeeProfile);
    EmployeeProfile findById(EmployeeProfile employeeProfile);
    List<EmployeeProfile> findAll();
    void delete(EmployeeProfile employeeProfile);
}
