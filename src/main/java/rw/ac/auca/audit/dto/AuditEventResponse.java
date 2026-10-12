package rw.ac.auca.audit.dto;

import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.domain.AuditEvent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** An audit event as the API shows it. */
public record AuditEventResponse(
        UUID id,
        Instant occurredAt,
        String actorUsername,
        String actorRole,
        AuditAction action,
        AuditEntity entityType,
        UUID entityId,
        String entityLabel,
        String summary,
        String note,
        String ipAddress,
        List<Change> changes) {

    /** {@code oldValue} is null for a new record, {@code newValue} for a deleted one; both are "(hidden)" for sensitive fields. */
    public record Change(String field, String oldValue, String newValue) {
    }

    public static AuditEventResponse from(AuditEvent e) {
        return new AuditEventResponse(
                e.getId(), e.getOccurredAt(), e.getActorUsername(), e.getActorRole(), e.getAction(), e.getEntityType(),
                e.getEntityId(), e.getEntityLabel(), e.getSummary(), e.getNote(), e.getIpAddress(),
                e.getChanges().stream().map(c -> new Change(c.getField(), c.getOldValue(), c.getNewValue())).toList());
    }

}
