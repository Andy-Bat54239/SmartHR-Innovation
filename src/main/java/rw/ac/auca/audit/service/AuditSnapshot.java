package rw.ac.auca.audit.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

/**
 * What a record looked like at one moment, as readable text per field ("Email" -> "a@b.rw").
 * Two snapshots taken before and after a change are compared to find what changed.
 * Fields added with {@link #putHidden} take part in that comparison but are never written to the log.
 */
public final class AuditSnapshot {

    private final Map<String, String> values = new LinkedHashMap<>();
    private final Set<String> hidden = new HashSet<>();

    private AuditSnapshot() {
    }

    public static AuditSnapshot create() {
        return new AuditSnapshot();
    }

    public AuditSnapshot put(String field, Object value) {
        values.put(field, display(value));
        return this;
    }

    /** For national IDs, dates of birth and the like: a change is noticed, the values are not kept. */
    public AuditSnapshot putHidden(String field, Object value) {
        values.put(field, display(value));
        hidden.add(field);
        return this;
    }

    Map<String, String> values() {
        return values;
    }

    boolean isHidden(String field) {
        return hidden.contains(field);
    }

    /** Blank and missing are the same thing; enums read as words ("ACTIVE" -> "Active"). */
    private static String display(Object value) {
        if (value == null) return null;
        String text = value instanceof Enum<?> e ? titleCase(e.name()) : value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    static String titleCase(String constant) {
        String spaced = constant.toLowerCase().replace('_', ' ');
        return spaced.substring(0, 1).toUpperCase() + spaced.substring(1);
    }
}
