(function initializeBORailData(root) {
  'use strict';

  const services = [
    ['A-local', 'A Line', 'assets/images/line-icons/a-local.png'],
    ['A-express', 'A Express', 'assets/images/line-icons/a-express.png'],
    ['B-local', 'B Line', 'assets/images/line-icons/b-local.png'],
    ['B-express', 'B Express', 'assets/images/line-icons/b-express.png'],
    ['C-local', 'C Line', 'assets/images/line-icons/c-local.png'],
    ['D-local', 'D Line', 'assets/images/line-icons/d-local.png'],
    ['E-local', 'E Line', 'assets/images/line-icons/e-local.png'],
    ['F-local', 'F Line', 'assets/images/line-icons/f-local.png'],
    ['F-express', 'F Express', 'assets/images/line-icons/f-express.png'],
    ['G-local', 'G Line', 'assets/images/line-icons/g-local.png'],
    ['S-local', 'S Line', 'assets/images/line-icons/s-local.png'],
    ['S-express', 'S Express', 'assets/images/line-icons/s-express.png']
  ].map(([id, label, icon]) => Object.freeze({ id, label, icon }));

  const stationNames = [
    'Newkirk','Newkirk - Oak Street','Hoganville','Bayview Park','Chelsea Bay','Berwick Hall',
    'Westpoint','Bradford Square','Bradford Bay','Cambridge Central','Atkinson Junction','Garner',
    'Kenilworth','La Vista','Brookfield Lawn','Boylston','Foxston','New Cottage','Whitebranch',
    'Burlington - University of NCU','Port Williamson','Willow Springs','Rockcastle','Cannon View',
    'Ivory Knolls','Djimar','Vanderburg','Ralston-Finch East','Atkins Bridge','Radcliff Fields',
    'Oakville City Airport','Veridia Nexus','Oakville Exchange','Oakville City Center','Oakville Plaza',
    'Leighton Castle','Fort Meadow','Yoakum','Joplin','Fernwood','Talmedge Hill','Mount River',
    'Perry Road','Mount Hindsboro','Wood-by-Hike','New Salemview','Millford Heights','Roxbury Landing',
    'East Heights','Alpherst','New Halifax','Tyford Farms','Scottsbury','Ameryville','Scottsdale',
    'Grant Park','Cherrywood','Brandywine','Santa Mora','Greens Corner','Doverville','Orchard Ridge',
    'Groveton','Madisonboro','Hutchinson Point','Vanwood','South Harrington','Harrington City',
    'Carrollton','Hadleigh'
  ];

  const accessible = new Set([
    'Newkirk','Newkirk - Oak Street','Hoganville','Bayview Park','Chelsea Bay','Berwick Hall',
    'Bradford Square','Bradford Bay','Cambridge Central','Atkinson Junction','Kenilworth','La Vista',
    'Brookfield Lawn','Boylston','Foxston','New Cottage','Whitebranch','Burlington - University of NCU',
    'Willow Springs','Rockcastle','Cannon View','Ivory Knolls','Vanderburg','Ralston-Finch East',
    'Atkins Bridge','Oakville City Airport','Veridia Nexus','Oakville Exchange','Oakville City Center',
    'Oakville Plaza','Leighton Castle','Fort Meadow','Yoakum','Fernwood','Talmedge Hill','Mount River',
    'Perry Road','Wood-by-Hike','New Salemview','Millford Heights','Roxbury Landing','East Heights',
    'Alpherst','Scottsbury','Ameryville','Scottsdale','Brandywine','Santa Mora','Greens Corner',
    'Doverville','Groveton','Madisonboro','Hutchinson Point','South Harrington','Harrington City',
    'Carrollton','Hadleigh'
  ]);

  root.BORailSettingsData = Object.freeze({
    services: Object.freeze(services),
    stations: Object.freeze(stationNames.slice().sort((a, b) => a.localeCompare(b)).map(name => Object.freeze({
      name,
      accessible: accessible.has(name)
    })))
  });
})(globalThis);
