package rw.ac.auca.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.dto.AuditEventResponse;
import rw.ac.auca.audit.service.AuditFilter;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.base.PageRequests;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * Read-only on purpose: the audit trail is written by the application itself as things happen,
 * and there is no endpoint to add, change or remove an entry. Administrators only (see SecurityConfig).
 */
@RestController
@RequestMapping("/audit")
public class AuditController {

    private static final Set<String> SORT_FIELDS = Set.of("occurredAt", "action", "entityType", "actorUsername");

    @Autowired
    private AuditService auditService;

    // ?page=0&size=25&sortBy=occurredAt&direction=desc, newest first by default.
    // Optional filters, combined with AND: q, action, entityType, entityId, actor, from, to (yyyy-MM-dd, inclusive)
    @GetMapping("/search-page")
    @ResponseStatus(HttpStatus.OK)
    public Page<AuditEventResponse> searchPage(@RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "25") int size,
                                               @RequestParam(defaultValue = "occurredAt") String sortBy,
                                               @RequestParam(defaultValue = "desc") String direction,
                                               @RequestParam(required = false) String q,
                                               @RequestParam(required = false) AuditAction action,
                                               @RequestParam(required = false) AuditEntity entityType,
                                               @RequestParam(required = false) UUID entityId,
                                               @RequestParam(required = false) String actor,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return auditService.search(new AuditFilter(q, action, entityType, entityId, actor, from, to),
                PageRequests.of(page, size, sortBy, direction, SORT_FIELDS));
    }
}
