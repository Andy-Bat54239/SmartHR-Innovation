package rw.ac.auca.location.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.exception.DuplicateResourceException;
import rw.ac.auca.exception.FieldValidationException;
import rw.ac.auca.exception.ResourceNotFoundException;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.location.domain.LocationType;
import rw.ac.auca.location.repository.LocationRepository;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshot;
import rw.ac.auca.audit.service.AuditSnapshots;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class LocationServiceImpl implements LocationService {

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AuditService audit;

    @Override
    @Transactional
    public Location registerLocation(Location location) {
        if (location.getType() == null) {
            throw new FieldValidationException("type", "Type is required");
        }
        checkCodeIsFree(location.getCode());
        location.setParent(resolveParent(location));
        Location saved = locationRepository.save(location);
        audit.created(AuditEntity.LOCATION, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public Location updateLocation(Location location) {
        Location found = findLocationById(location);
        AuditSnapshot before = AuditSnapshots.of(found);

        // Only re-check uniqueness when the value actually changes
        String newCode = blankToNull(location.getCode());
        if (newCode != null && !newCode.equals(found.getCode())) {
            checkCodeIsFree(newCode);
        }
        // Type and parent are fixed once created, so the tree cannot be broken by an update
        found.setName(location.getName());
        found.setCode(newCode);
        Location saved = locationRepository.save(found);
        audit.updated(AuditEntity.LOCATION, saved.getId(), AuditSnapshots.label(saved), before, AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public void deleteLocation(Location location) {
        Location found = findLocationById(location);
        AuditSnapshot snapshot = AuditSnapshots.of(found);
        String label = AuditSnapshots.label(found);
        // The whole subtree goes with it (cascade), but employees must survive
        List<UUID> subtree = findAllDescendantIds(found.getId());
        List<Employee> located = employeeRepository.findByLocation_IdIn(subtree);
        for (Employee employee : located) {
            employee.setLocation(null);
        }
        employeeRepository.flush();
        locationRepository.delete(found);

        List<String> notes = new java.util.ArrayList<>();
        if (subtree.size() > 1) {
            notes.add(subtree.size() == 2 ? "1 place inside it was deleted too" : (subtree.size() - 1) + " places inside it were deleted too");
        }
        if (!located.isEmpty()) {
            notes.add(located.size() == 1 ? "1 employee no longer has a location" : located.size() + " employees no longer have a location");
        }
        audit.deleted(AuditEntity.LOCATION, found.getId(), label, snapshot, notes.isEmpty() ? null : String.join("; ", notes));
    }

    @Override
    @Transactional(readOnly = true)
    public Location findLocationById(Location location) {
        return locationRepository.findById(location.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", location.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Location> findAllLocations() {
        return locationRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Location> findLocationsByType(LocationType type) {
        return locationRepository.findByType(type);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Location> findChildren(UUID parentId) {
        if (!locationRepository.existsById(parentId)) {
            throw new ResourceNotFoundException("Location", parentId);
        }
        return locationRepository.findByParent_Id(parentId);
    }

    @Override
    @Transactional(readOnly = true)
    public Location findProvinceByCode(String code) {
        return locationRepository.findByCodeAndType(code, LocationType.PROVINCE)
                .orElseThrow(() -> new ResourceNotFoundException("No province with code '" + code + "'"));
    }

    @Override
    @Transactional(readOnly = true)
    public Location findProvinceByName(String name) {
        return locationRepository.findFirstByNameIgnoreCaseAndType(name, LocationType.PROVINCE)
                .orElseThrow(() -> new ResourceNotFoundException("No province named '" + name + "'"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<UUID> findAllDescendantIds(UUID rootId) {
        List<UUID> ids = new ArrayList<>();
        ids.add(rootId);
        List<UUID> currentLevel = List.of(rootId);
        while (!currentLevel.isEmpty()) {
            List<UUID> nextLevel = new ArrayList<>();
            for (UUID parentId : currentLevel) {
                for (Location child : locationRepository.findByParent_Id(parentId)) {
                    ids.add(child.getId());
                    nextLevel.add(child.getId());
                }
            }
            currentLevel = nextLevel;
        }
        return ids;
    }

    /** Provinces have no parent; every other level needs a parent exactly one level above it. */
    private Location resolveParent(Location location) {
        if (location.getType() == LocationType.PROVINCE) {
            return null;
        }
        if (location.getParent() == null || location.getParent().getId() == null) {
            LocationType above = LocationType.values()[location.getType().ordinal() - 1];
            throw new FieldValidationException("parent", "A " + label(location.getType()) + " must be inside a " + label(above));
        }
        Location parent = locationRepository.findById(location.getParent().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", location.getParent().getId()));
        if (parent.getType().ordinal() + 1 != location.getType().ordinal()) {
            throw new FieldValidationException("parent", "A " + label(location.getType()) + " must be inside a "
                    + label(LocationType.values()[location.getType().ordinal() - 1]) + ", not a " + label(parent.getType()));
        }
        return parent;
    }

    /** "DISTRICT" -> "district", for messages. */
    private String label(LocationType type) {
        return type.name().toLowerCase();
    }

    private void checkCodeIsFree(String code) {
        if (blankToNull(code) != null && locationRepository.existsByCode(code)) {
            throw new DuplicateResourceException("code", "Location code already in use: " + code);
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
