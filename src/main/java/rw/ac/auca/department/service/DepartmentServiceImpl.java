package rw.ac.auca.department.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.department.domain.Department;
import rw.ac.auca.department.repository.DepartmentRepository;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshot;
import rw.ac.auca.audit.service.AuditSnapshots;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.exception.DuplicateResourceException;
import rw.ac.auca.exception.ResourceNotFoundException;

import java.util.List;

@Service
public class DepartmentServiceImpl implements DepartmentService{

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private AuditService audit;

    @Override
    @Transactional
    public Department registerDepartment(Department department) {
        if (departmentRepository.existsByName(department.getName())) {
            throw new DuplicateResourceException("name", "Department name already in use: " + department.getName());
        }
        if (departmentRepository.existsByCode(department.getCode())) {
            throw new DuplicateResourceException("code", "Department code already in use: " + department.getCode());
        }
        Department saved = departmentRepository.save(department);
        audit.created(AuditEntity.DEPARTMENT, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public Department updateDepartment(Department department) {
        Department found = findDepartmentById(department);
        AuditSnapshot before = AuditSnapshots.of(found);

        // Only re-check uniqueness when the value actually changes
        if (!found.getName().equals(department.getName())
                && departmentRepository.existsByName(department.getName())) {
            throw new DuplicateResourceException("name", "Department name already in use: " + department.getName());
        }
        if (!found.getCode().equals(department.getCode())
                && departmentRepository.existsByCode(department.getCode())) {
            throw new DuplicateResourceException("code", "Department code already in use: " + department.getCode());
        }

        found.setName(department.getName());
        found.setCode(department.getCode());
        found.setDescription(department.getDescription());
        Department saved = departmentRepository.save(found);
        audit.updated(AuditEntity.DEPARTMENT, saved.getId(), AuditSnapshots.label(saved), before, AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public void deleteDepartment(Department department) {
        Department found = findDepartmentById(department);
        AuditSnapshot snapshot = AuditSnapshots.of(found);
        String label = AuditSnapshots.label(found);
        int unassigned = found.getEmployees().size();
        // Employees survive the department: clear their foreign key first
        for (Employee employee : found.getEmployees()) {
            employee.setDepartment(null);
        }
        departmentRepository.delete(found);
        audit.deleted(AuditEntity.DEPARTMENT, found.getId(), label, snapshot,
                unassigned == 0 ? null : unassigned == 1 ? "1 employee no longer belongs to a department" : unassigned + " employees no longer belong to a department");
    }

    @Override
    @Transactional(readOnly = true)
    public Department findDepartmentById(Department department) {
        return departmentRepository.findById(department.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", department.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Department> findAllDepartments() {
        return departmentRepository.findAll();
    }
}
