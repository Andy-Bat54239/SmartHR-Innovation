package rw.ac.auca.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.location.domain.LocationType;
import rw.ac.auca.location.service.LocationService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/location")
public class LocationController {

    @Autowired
    private LocationService locationService;

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    public Location createLocation(@Valid @RequestBody Location location){
        return locationService.registerLocation(location);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Location updateLocation(@PathVariable UUID id, @Valid @RequestBody Location location){
        location.setId(id);
        return locationService.updateLocation(location);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLocation(@PathVariable UUID id){
        Location location = new Location();
        location.setId(id);
        locationService.deleteLocation(location);
    }

    @GetMapping("/search-all")
    @ResponseStatus(HttpStatus.OK)
    public List<Location> findAllLocations(){
        return locationService.findAllLocations();
    }

    @GetMapping("/search/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Location findLocationById(@PathVariable UUID id){
        Location location = new Location();
        location.setId(id);
        return locationService.findLocationById(location);
    }

    @GetMapping("/type/{type}")
    @ResponseStatus(HttpStatus.OK)
    public List<Location> findLocationsByType(@PathVariable LocationType type){
        return locationService.findLocationsByType(type);
    }

    @GetMapping("/{id}/children")
    @ResponseStatus(HttpStatus.OK)
    public List<Location> findChildren(@PathVariable UUID id){
        return locationService.findChildren(id);
    }
}
