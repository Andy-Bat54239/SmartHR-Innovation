package rw.ac.auca.exception;

/**
 * Thrown when an entity cannot be found. Mapped to HTTP 404.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public ResourceNotFoundException(String resourceName, Object id) {
        super(resourceName + " not found with id: '" + id + "'");
    }
}
