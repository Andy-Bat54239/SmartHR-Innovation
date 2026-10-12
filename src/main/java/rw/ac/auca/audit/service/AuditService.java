package rw.ac.auca.audit.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.dto.AuditEventResponse;

import java.util.UUID;

/**
 * The audit trail. The methods that describe a change join the caller's transaction, so the trail and the
 * data always agree: a change that is rolled back leaves no entry, and a change cannot be saved without one.
 */
public interface AuditService {

    /** A new record, with every (non-sensitive) field it started with. */
    void created(AuditEntity type, UUID id, String label, AuditSnapshot snapshot);

    /** A change: only the fields that differ are kept, and nothing is written when none does. */
    void updated(AuditEntity type, UUID id, String label, AuditSnapshot before, AuditSnapshot after);

    /** A deleted record, with what it held, and optionally a note about what went with it. */
    void deleted(AuditEntity type, UUID id, String label, AuditSnapshot snapshot, String note);

    /** A workflow step that is not a plain create / update / delete: approving leave, enrolling someone... */
    void action(AuditAction action, AuditEntity type, UUID id, String label, String summary, String note);

    /**
     * A sign-in event. It is written in a transaction of its own: a failed sign-in rolls back the caller's
     * transaction, and the record of the attempt must survive that.
     */
    void signIn(AuditAction action, String username, UUID userId, String role, String summary, String note);

    Page<AuditEventResponse> search(AuditFilter filter, Pageable pageable);
}
