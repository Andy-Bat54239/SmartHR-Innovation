package rw.ac.auca.employee_profile.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.employee_profile.domain.EmployeeProfile;
import rw.ac.auca.employee_profile.repository.EmployeeProfileRepository;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshot;
import rw.ac.auca.audit.service.AuditSnapshots;
import rw.ac.auca.exception.DuplicateResourceException;
import rw.ac.auca.exception.ResourceNotFoundException;

import java.util.List;

@Service
public class EmployeeProfileServiceImpl implements EmployeeProfileService{

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private AuditService audit;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Override
    @Transactional
    public EmployeeProfile saveProfile(EmployeeProfile employeeProfile) {
        if (employeeProfileRepository.existsByNationalId(employeeProfile.getNationalId())) {
            throw new DuplicateResourceException("nationalId", "National ID already in use: " + employeeProfile.getNationalId());
        }
        EmployeeProfile saved = employeeProfileRepository.save(employeeProfile);
        audit.created(AuditEntity.PROFILE, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public EmployeeProfile updateProfile(EmployeeProfile employeeProfile) {
        EmployeeProfile profileFound = findById(employeeProfile);
        AuditSnapshot before = AuditSnapshots.of(profileFound);

        // Only re-check uniqueness when the value actually changes
        if (!profileFound.getNationalId().equals(employeeProfile.getNationalId())
                && employeeProfileRepository.existsByNationalId(employeeProfile.getNationalId())) {
            throw new DuplicateResourceException("nationalId", "National ID already in use: " + employeeProfile.getNationalId());
        }

        // "employee" is the inverse side of the relation, the link is managed from Employee.profile
        profileFound.setProfilePhotoUrl(employeeProfile.getProfilePhotoUrl());
        profileFound.setDateOfBirth(employeeProfile.getDateOfBirth());
        profileFound.setNationalId(employeeProfile.getNationalId());
        profileFound.setEducationLevel(employeeProfile.getEducationLevel());
        EmployeeProfile saved = employeeProfileRepository.save(profileFound);
        audit.updated(AuditEntity.PROFILE, saved.getId(), AuditSnapshots.label(saved), before, AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeProfile findById(EmployeeProfile employeeProfile) {
        return employeeProfileRepository.findById(employeeProfile.getId())
                .orElseThrow(() -> new ResourceNotFoundException("EmployeeProfile", employeeProfile.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeProfile> findAll() {
        return employeeProfileRepository.findAll();
    }

    @Override
    @Transactional
    public void delete(EmployeeProfile employeeProfile) {
        EmployeeProfile found = findById(employeeProfile);
        AuditSnapshot snapshot = AuditSnapshots.of(found);
        String label = AuditSnapshots.label(found);
        // The employee owns the foreign key: unlink first so the delete does not violate it
        Employee owner = found.getEmployee();
        if (owner != null) {
            owner.setProfile(null);
            employeeRepository.save(owner);
        }
        employeeProfileRepository.delete(found);
        audit.deleted(AuditEntity.PROFILE, found.getId(), label, snapshot, null);
    }
}
