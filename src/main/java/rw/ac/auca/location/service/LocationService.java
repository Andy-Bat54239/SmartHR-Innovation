package rw.ac.auca.location.service;

import rw.ac.auca.location.domain.Location;
import rw.ac.auca.location.domain.LocationType;

import java.util.List;
import java.util.UUID;

public interface LocationService {
    Location registerLocation(Location location);
    Location updateLocation(Location location);
    void deleteLocation(Location location);
    Location findLocationById(Location location);
    List<Location> findAllLocations();
    List<Location> findLocationsByType(LocationType type);
    List<Location> findChildren(UUID parentId);
    Location findProvinceByCode(String code);
    Location findProvinceByName(String name);

    /** The given node plus every descendant, used to find employees anywhere below a province. */
    List<UUID> findAllDescendantIds(UUID rootId);
}
