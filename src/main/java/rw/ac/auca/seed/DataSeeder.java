package rw.ac.auca.seed;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.department.domain.Department;
import rw.ac.auca.department.repository.DepartmentRepository;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.location.domain.LocationType;
import rw.ac.auca.location.repository.LocationRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads reference data on the very first start: Rwanda's 5 provinces, all 30 districts,
 * the sectors of Kigali City, and a starter set of departments.
 * Each table is seeded only while it is empty, so anything entered later is never touched.
 * Cells and villages (thousands of rows) are added through the API.
 * Turn it off with smarthr.seed.enabled=false.
 */
@Component
@ConditionalOnProperty(name = "smarthr.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedDepartments();
        seedLocations();
    }

    private void seedDepartments() {
        if (departmentRepository.count() > 0) {
            return;
        }
        Map<String, String[]> departments = new LinkedHashMap<>();
        departments.put("Human Resources", new String[]{"HR", "Recruitment, leave, training and staff records"});
        departments.put("Finance", new String[]{"FIN", "Payroll, budgeting and accounting"});
        departments.put("Information Technology", new String[]{"IT", "Systems, networks and technical support"});
        departments.put("Operations", new String[]{"OPS", "Day-to-day running of the organisation"});
        departments.put("Marketing", new String[]{"MKT", "Communication, branding and outreach"});
        departments.put("Administration", new String[]{"ADM", "Office management and logistics"});

        departments.forEach((name, info) -> {
            Department department = new Department();
            department.setName(name);
            department.setCode(info[0]);
            department.setDescription(info[1]);
            departmentRepository.save(department);
        });
        log.info("Seeded {} departments", departments.size());
    }

    private void seedLocations() {
        if (locationRepository.count() > 0) {
            return;
        }
        int districts = 0;
        int sectors = 0;
        for (ProvinceSeed seed : PROVINCES) {
            Location province = save(seed.name(), LocationType.PROVINCE, seed.code(), null);
            for (Map.Entry<String, List<String>> district : seed.districts().entrySet()) {
                Location districtNode = save(district.getKey(), LocationType.DISTRICT, null, province);
                districts++;
                for (String sector : district.getValue()) {
                    save(sector, LocationType.SECTOR, null, districtNode);
                    sectors++;
                }
            }
        }
        log.info("Seeded {} provinces, {} districts and {} sectors", PROVINCES.size(), districts, sectors);
    }

    private Location save(String name, LocationType type, String code, Location parent) {
        Location location = new Location();
        location.setName(name);
        location.setType(type);
        location.setCode(code);
        location.setParent(parent);
        return locationRepository.save(location);
    }

    private record ProvinceSeed(String name, String code, Map<String, List<String>> districts) {
    }

    /** Districts with no sector list are added without sectors. */
    private static Map<String, List<String>> districts(String... names) {
        Map<String, List<String>> map = new LinkedHashMap<>();
        for (String name : names) {
            map.put(name, List.of());
        }
        return map;
    }

    /** Kigali City is small enough to seed down to sector level. */
    private static Map<String, List<String>> kigaliDistricts() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("Gasabo", List.of("Bumbogo", "Gatsata", "Gikomero", "Gisozi", "Jabana", "Jali", "Kacyiru",
                "Kimihurura", "Kimironko", "Kinyinya", "Ndera", "Nduba", "Remera", "Rusororo", "Rutunga"));
        map.put("Kicukiro", List.of("Gahanga", "Gatenga", "Gikondo", "Kagarama", "Kanombe", "Kicukiro",
                "Kigarama", "Masaka", "Niboye", "Nyarugunga"));
        map.put("Nyarugenge", List.of("Gitega", "Kanyinya", "Kigali", "Kimisagara", "Mageragere", "Muhima",
                "Nyakabanda", "Nyamirambo", "Nyarugenge", "Rwezamenyo"));
        return map;
    }

    private static final List<ProvinceSeed> PROVINCES = List.of(
            new ProvinceSeed("Kigali City", "KIG", kigaliDistricts()),
            new ProvinceSeed("Northern Province", "NOR",
                    districts("Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo")),
            new ProvinceSeed("Southern Province", "SOU",
                    districts("Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango")),
            new ProvinceSeed("Eastern Province", "EAS",
                    districts("Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana")),
            new ProvinceSeed("Western Province", "WES",
                    districts("Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro"))
    );
}
