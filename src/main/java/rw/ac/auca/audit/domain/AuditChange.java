package rw.ac.auca.audit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One field of one event: what it was and what it became. A new record has no old value, a deleted one no new value.
 * For fields too sensitive to keep (national ID, date of birth) both sides are {@link #HIDDEN}: the log says
 * that it changed, never to what.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class AuditChange {

    public static final String HIDDEN = "(hidden)";

    @Column(name = "field_name", nullable = false, length = 100, updatable = false)
    private String field;

    @Column(name = "old_value", length = 500, updatable = false)
    private String oldValue;

    @Column(name = "new_value", length = 500, updatable = false)
    private String newValue;
}
