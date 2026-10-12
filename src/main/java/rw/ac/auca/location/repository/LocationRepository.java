package rw.ac.auca.location.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.location.domain.LocationType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LocationRepository extends JpaRepository<Location, UUID> {
    boolean existsByCode(String code);
    List<Location> findByType(LocationType type);
    List<Location> findByParent_Id(UUID parentId);
    Optional<Location> findByCodeAndType(String code, LocationType type);
    Optional<Location> findFirstByNameIgnoreCaseAndType(String name, LocationType type);

    /** Every location as id / parent / name / type only, for rolling counts up to provinces without loading entities. */
    @Query("select l.id as id, l.parent.id as parentId, l.name as name, l.type as type from Location l")
    List<LocationNode> findAllNodes();

    interface LocationNode {
        UUID getId();
        UUID getParentId();
        String getName();
        LocationType getType();
    }
}
