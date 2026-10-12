package rw.ac.auca.user.dto;

import rw.ac.auca.employee.domain.Employee;

/** The signed-in account and, when it is linked to one, the employee record behind it. */
public record MeResponse(UserResponse user, Employee employee) {
}
