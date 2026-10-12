package rw.ac.auca.audit.service;

import rw.ac.auca.department.domain.Department;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee_profile.domain.EmployeeProfile;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.training.domain.Training;
import rw.ac.auca.user.domain.AppUser;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * For each kind of record: how to describe it in one line (the label) and field by field (the snapshot).
 * This is the one place that decides what the audit trail is allowed to hold about a record.
 * Passwords and password hashes are never here, and the profile's national ID and date of birth are hidden.
 */
public final class AuditSnapshots {

    private AuditSnapshots() {
    }

    // ---- labels ----

    public static String label(Employee e) {
        return e.getFirstName() + " " + e.getLastName();
    }

    public static String label(EmployeeProfile p) {
        return p.getEmployee() == null ? "(not linked to an employee)" : label(p.getEmployee());   // the summary already says "profile"
    }

    public static String label(Department d) {
        return d.getName();
    }

    public static String label(Location l) {
        return l.getName() + " (" + AuditSnapshot.titleCase(l.getType().name()).toLowerCase() + ")";
    }

    public static String label(Training t) {
        return t.getTitle();
    }

    public static String label(LeaveRequest l) {
        String dates = l.getStartDate().equals(l.getEndDate()) ? l.getStartDate().toString() : l.getStartDate() + " to " + l.getEndDate();
        return label(l.getEmployee()) + " · " + AuditSnapshot.titleCase(l.getType().name()) + " · " + dates;
    }

    public static String label(AppUser u) {
        return u.getUsername();
    }

    // ---- snapshots ----

    public static AuditSnapshot of(Employee e) {
        return AuditSnapshot.create()
                .put("First name", e.getFirstName())
                .put("Last name", e.getLastName())
                .put("Email", e.getEmail())
                .put("Phone", e.getPhone())
                .put("Gender", e.getGender())
                .put("Hire date", e.getHireDate())
                .put("Status", e.getStatus())
                .put("Department", e.getDepartment() == null ? null : e.getDepartment().getName())
                .put("Location", locationPath(e.getLocation()))
                .put("Profile", e.getProfile() == null ? null : "Recorded");
    }

    public static AuditSnapshot of(EmployeeProfile p) {
        return AuditSnapshot.create()
                .putHidden("National ID", p.getNationalId())
                .putHidden("Date of birth", p.getDateOfBirth())
                .put("Education level", p.getEducationLevel())
                .put("Photo URL", p.getProfilePhotoUrl());
    }

    public static AuditSnapshot of(Department d) {
        return AuditSnapshot.create()
                .put("Name", d.getName())
                .put("Code", d.getCode())
                .put("Description", d.getDescription());
    }

    public static AuditSnapshot of(Location l) {
        return AuditSnapshot.create()
                .put("Name", l.getName())
                .put("Type", l.getType())
                .put("Code", l.getCode())
                .put("Inside", l.getParent() == null ? null : l.getParent().getName());
    }

    public static AuditSnapshot of(Training t) {
        return AuditSnapshot.create()
                .put("Title", t.getTitle())
                .put("Trainer", t.getTrainer())
                .put("Start date", t.getStartDate())
                .put("End date", t.getEndDate())
                .put("Description", t.getDescription());
    }

    public static AuditSnapshot of(LeaveRequest l) {
        return AuditSnapshot.create()
                .put("Employee", label(l.getEmployee()))
                .put("Type", l.getType())
                .put("Start date", l.getStartDate())
                .put("End date", l.getEndDate())
                .put("Reason", l.getReason())
                .put("Status", l.getStatus());
    }

    /** No password, no hash, no token version: only what an administrator chooses about the account. */
    public static AuditSnapshot of(AppUser u) {
        return AuditSnapshot.create()
                .put("Username", u.getUsername())
                .put("Role", u.getRole())
                .put("Status", u.isEnabled() ? "Active" : "Switched off")
                .put("Employee", u.getEmployee() == null ? null : label(u.getEmployee()));
    }

    /** "Kigali City › Gasabo › Kimironko", province first. */
    public static String locationPath(Location location) {
        if (location == null) return null;
        List<String> names = new ArrayList<>();
        for (Location current = location; current != null; current = current.getParent()) {
            names.add(current.getName());
        }
        Collections.reverse(names);
        return String.join(" › ", names);
    }
}
