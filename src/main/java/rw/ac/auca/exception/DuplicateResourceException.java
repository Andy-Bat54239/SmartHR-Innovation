package rw.ac.auca.exception;

/**
 * Thrown when a unique value (email, code, national id...) is already in use. Mapped to HTTP 409.
 * When the clash is on one input field, {@code field} names it so a form can show the message next to it.
 */
public class DuplicateResourceException extends RuntimeException {

    private final String field;

    public DuplicateResourceException(String message) {
        this(null, message);
    }

    public DuplicateResourceException(String field, String message) {
        super(message);
        this.field = field;
    }

    /** The request field that clashed (e.g. "email"), or null when the conflict is not about one field. */
    public String getField() {
        return field;
    }
}
