package rw.ac.auca.audit.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import rw.ac.auca.base.BaseEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One line of the audit trail: who did what to which record, when, and from where.
 * It is append-only. Nothing in the application updates or deletes an event, and every column is marked
 * non-updatable. The actor's name and the record's label are copied in, so the entry still reads
 * correctly after the account or the record is gone.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "audit_event", indexes = {
        @Index(name = "idx_audit_occurred_at", columnList = "occurred_at"),
        @Index(name = "idx_audit_entity", columnList = "entity_type, entity_id")
})
public class AuditEvent extends BaseEntity {

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    /** The account that did it; null for the system itself and for a sign-in that failed. */
    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    /** Who did it, as a name: the username, "system", or the username that was tried in a failed sign-in. */
    @Column(name = "actor_username", nullable = false, length = 150, updatable = false)
    private String actorUsername;

    @Column(name = "actor_role", length = 20, updatable = false)
    private String actorRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 40, updatable = false)
    private AuditAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 30, updatable = false)
    private AuditEntity entityType;

    @Column(name = "entity_id", updatable = false)
    private UUID entityId;

    /** The record's name at the time ("Aline Uwase"), kept because the record may be deleted later. */
    @Column(name = "entity_label", length = 255, updatable = false)
    private String entityLabel;

    /** One readable sentence: "Changed employee Aline Uwase: Email, Phone". */
    @Column(name = "summary", nullable = false, length = 500, updatable = false)
    private String summary;

    /** Anything worth knowing that is not a field: "Also removed: 2 leave requests". */
    @Column(name = "note", length = 500, updatable = false)
    private String note;

    @Column(name = "ip_address", length = 64, updatable = false)
    private String ipAddress;

    @ElementCollection
    @CollectionTable(name = "audit_event_change", joinColumns = @JoinColumn(name = "event_id"))
    @OrderColumn(name = "position")
    @BatchSize(size = 50)
    private List<AuditChange> changes = new ArrayList<>();
}
