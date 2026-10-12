package rw.ac.auca.base;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;
import java.util.TreeSet;

/**
 * Builds a validated Pageable from the ?page=&size=&sortBy=&direction= query parameters.
 * Sorting is limited to a whitelist per entity so a bad "sortBy" gives a 400, not a 500.
 */
public final class PageRequests {

    public static final int MAX_SIZE = 100;

    private PageRequests() {
    }

    public static Pageable of(int page, int size, String sortBy, String direction, Set<String> allowedSortFields) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be 0 or more");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MAX_SIZE);
        }
        if (!allowedSortFields.contains(sortBy)) {
            throw new IllegalArgumentException(
                    "Cannot sort by '" + sortBy + "'. Allowed: " + new TreeSet<>(allowedSortFields));
        }
        Sort.Direction dir;
        if ("asc".equalsIgnoreCase(direction)) {
            dir = Sort.Direction.ASC;
        } else if ("desc".equalsIgnoreCase(direction)) {
            dir = Sort.Direction.DESC;
        } else {
            throw new IllegalArgumentException("direction must be 'asc' or 'desc'");
        }
        Sort sort = Sort.by(dir, sortBy);
        if (!"id".equals(sortBy)) {
            // tie-breaker: rows with an equal sort value must not move between pages
            sort = sort.and(Sort.by("id"));
        }
        return PageRequest.of(page, size, sort);
    }
}
