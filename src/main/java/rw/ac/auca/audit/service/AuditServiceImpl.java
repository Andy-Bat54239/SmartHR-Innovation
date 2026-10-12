package rw.ac.auca.audit.service;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditChange;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.domain.AuditEvent;
import rw.ac.auca.audit.dto.AuditEventResponse;
import rw.ac.auca.audit.repository.AuditEventRepository;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AuditServiceImpl implements AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditServiceImpl.class);

    private static final int MAX_VALUE_LENGTH = 500;
    private static final int MAX_FIELDS_IN_SUMMARY = 3;

    // Failed sign-ins can be produced by anybody, so the trail keeps at most this many of them per minute.
    // Beyond that they are dropped (the lockout still works) rather than letting a flood fill the table.
    private static final int MAX_FAILED_SIGN_INS_PER_MINUTE = 60;
    private final AtomicLong failedWindowStart = new AtomicLong();
    private final AtomicInteger failedInWindow = new AtomicInteger();

    @Autowired
    private AuditEventRepository events;

    // ---- changes to records (same transaction as the change) ----

    @Override
    @Transactional
    public void created(AuditEntity type, UUID id, String label, AuditSnapshot snapshot) {
        List<AuditChange> changes = new ArrayList<>();
        for (Map.Entry<String, String> field : snapshot.values().entrySet()) {
            if (field.getValue() != null) {
                changes.add(change(snapshot, field.getKey(), null, field.getValue()));
            }
        }
        write(actionFor(type, AuditAction.CREATED), type, id, label, "Created " + type.noun() + " " + label, null, changes);
    }

    @Override
    @Transactional
    public void updated(AuditEntity type, UUID id, String label, AuditSnapshot before, AuditSnapshot after) {
        Set<String> fields = new LinkedHashSet<>(after.values().keySet());
        fields.addAll(before.values().keySet());

        List<AuditChange> changes = new ArrayList<>();
        for (String field : fields) {
            String was = before.values().get(field);
            String now = after.values().get(field);
            if (!Objects.equals(was, now)) {
                changes.add(change(after.isHidden(field) ? after : before, field, was, now));
            }
        }
        if (changes.isEmpty()) {
            return;   // saved without changing anything: nothing to record
        }
        List<String> names = changes.stream().map(AuditChange::getField).toList();
        String shown = String.join(", ", names.subList(0, Math.min(MAX_FIELDS_IN_SUMMARY, names.size())));
        if (names.size() > MAX_FIELDS_IN_SUMMARY) {
            shown += " and " + (names.size() - MAX_FIELDS_IN_SUMMARY) + " more";
        }
        write(actionFor(type, AuditAction.UPDATED), type, id, label, "Changed " + type.noun() + " " + label + ": " + shown, null, changes);
    }

    @Override
    @Transactional
    public void deleted(AuditEntity type, UUID id, String label, AuditSnapshot snapshot, String note) {
        List<AuditChange> changes = new ArrayList<>();
        for (Map.Entry<String, String> field : snapshot.values().entrySet()) {
            if (field.getValue() != null) {
                changes.add(change(snapshot, field.getKey(), field.getValue(), null));
            }
        }
        write(actionFor(type, AuditAction.DELETED), type, id, label, "Deleted " + type.noun() + " " + label, note, changes);
    }

    @Override
    @Transactional
    public void action(AuditAction action, AuditEntity type, UUID id, String label, String summary, String note) {
        write(action, type, id, label, summary, note, List.of());
    }

    // ---- sign-in events (own transaction) ----

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void signIn(AuditAction action, String username, UUID userId, String role, String summary, String note) {
        if (action == AuditAction.SIGN_IN_FAILED && !allowFailedSignInEntry()) {
            log.warn("Too many failed sign-ins per minute: further ones are not written to the audit trail for now");
            return;
        }
        AuditEvent event = newEvent(action, AuditEntity.ACCOUNT, userId, username, summary, note, List.of());
        event.setActorId(userId);
        event.setActorUsername(truncate(username, 150));
        event.setActorRole(role);
        events.save(event);
    }

    // ---- reading ----

    @Override
    @Transactional(readOnly = true)
    public Page<AuditEventResponse> search(AuditFilter filter, Pageable pageable) {
        Specification<AuditEvent> spec = (root, query, cb) -> cb.conjunction();

        String text = filter.q() == null ? "" : filter.q().trim().toLowerCase();
        if (!text.isEmpty()) {
            String pattern = "%" + escapeLike(text) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.<String>get("summary")), pattern, '\\'),
                    cb.like(cb.lower(root.<String>get("actorUsername")), pattern, '\\'),
                    cb.like(cb.lower(root.<String>get("entityLabel")), pattern, '\\')));
        }
        String actor = filter.actor() == null ? "" : filter.actor().trim().toLowerCase();
        if (!actor.isEmpty()) {
            String pattern = "%" + escapeLike(actor) + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.<String>get("actorUsername")), pattern, '\\'));
        }
        if (filter.action() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("action"), filter.action()));
        }
        if (filter.entityType() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("entityType"), filter.entityType()));
        }
        if (filter.entityId() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("entityId"), filter.entityId()));
        }
        ZoneId zone = ZoneId.systemDefault();
        if (filter.from() != null) {
            Instant start = filter.from().atStartOfDay(zone).toInstant();
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.<Instant>get("occurredAt"), start));
        }
        if (filter.to() != null) {
            Instant end = filter.to().plusDays(1).atStartOfDay(zone).toInstant();
            spec = spec.and((root, query, cb) -> cb.lessThan(root.<Instant>get("occurredAt"), end));
        }
        return events.findAll(spec, pageable).map(AuditEventResponse::from);
    }

    // ---- helpers ----

    private void write(AuditAction action, AuditEntity type, UUID id, String label, String summary, String note, List<AuditChange> changes) {
        AuditActor actor = AuditActor.current();
        AuditEvent event = newEvent(action, type, id, label, summary, note, changes);
        event.setActorId(actor.id());
        event.setActorUsername(actor.username());
        event.setActorRole(actor.role());
        events.save(event);
    }

    private AuditEvent newEvent(AuditAction action, AuditEntity type, UUID id, String label, String summary, String note, List<AuditChange> changes) {
        AuditEvent event = new AuditEvent();
        event.setOccurredAt(Instant.now());
        event.setAction(action);
        event.setEntityType(type);
        event.setEntityId(id);
        event.setEntityLabel(truncate(label, 255));
        event.setSummary(truncate(summary, 500));
        event.setNote(truncate(note, 500));
        event.setIpAddress(currentIp());
        event.getChanges().addAll(changes);
        return event;
    }

    /** Hidden fields keep neither the old nor the new value, only the fact that there was one. */
    private AuditChange change(AuditSnapshot source, String field, String oldValue, String newValue) {
        if (source.isHidden(field)) {
            return new AuditChange(field, oldValue == null ? null : AuditChange.HIDDEN, newValue == null ? null : AuditChange.HIDDEN);
        }
        return new AuditChange(field, truncate(oldValue, MAX_VALUE_LENGTH), truncate(newValue, MAX_VALUE_LENGTH));
    }

    /** Accounts have their own action names so the trail can be filtered by them. */
    private AuditAction actionFor(AuditEntity type, AuditAction plain) {
        if (type != AuditEntity.ACCOUNT) return plain;
        return switch (plain) {
            case CREATED -> AuditAction.ACCOUNT_CREATED;
            case UPDATED -> AuditAction.ACCOUNT_UPDATED;
            case DELETED -> AuditAction.ACCOUNT_DELETED;
            default -> plain;
        };
    }

    /** The address the request came from. Behind a proxy this is the proxy's, since forwarded headers can be forged. */
    private String currentIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            return truncate(request.getRemoteAddr(), 64);
        }
        return null;
    }

    private boolean allowFailedSignInEntry() {
        long now = System.currentTimeMillis();
        long start = failedWindowStart.get();
        if (now - start >= 60_000 && failedWindowStart.compareAndSet(start, now)) {
            failedInWindow.set(0);
        }
        return failedInWindow.incrementAndGet() <= MAX_FAILED_SIGN_INS_PER_MINUTE;
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
