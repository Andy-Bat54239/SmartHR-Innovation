package rw.ac.auca.audit.service;

import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Optional filters of the audit search; the ones given are combined with AND.
 *
 * @param q     text found in the summary, the actor's name or the record's label (ignores case)
 * @param actor text found in the actor's username
 * @param from  first day to include (the server's local day)
 * @param to    last day to include
 */
public record AuditFilter(String q, AuditAction action, AuditEntity entityType, UUID entityId, String actor, LocalDate from, LocalDate to) {
}
