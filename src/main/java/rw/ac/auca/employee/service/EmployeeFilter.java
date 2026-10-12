package rw.ac.auca.employee.service;

import rw.ac.auca.employee.domain.EmployeeStatus;
import rw.ac.auca.employee.domain.Gender;

import java.util.UUID;

/**
 * Optional filters of the employee search. Every field may be null; the ones given are combined with AND.
 *
 * @param q          text found in the first name, last name, full name, email or phone (ignores case)
 * @param provinceId only employees living anywhere inside this province
 */
public record EmployeeFilter(String q, EmployeeStatus status, Gender gender, UUID departmentId, UUID provinceId) {
}
