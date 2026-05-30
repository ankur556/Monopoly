"""Static Monopoly board data — squares, rents, prices, house costs."""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Square:
    position: int
    name: str
    type: str  # 'go','property','railroad','utility','tax','chance','chest','jail','free_parking','go_to_jail'
    price: int = 0
    rents: List[int] = field(default_factory=list)  # [base, 1h, 2h, 3h, 4h, hotel]
    house_cost: int = 0
    mortgage_value: int = 0
    color: Optional[str] = None  # 'brown','light_blue','pink','orange','red','yellow','green','dark_blue'
    tax_amount: int = 0


BOARD: List[Square] = [
    # 0 — Go
    Square(position=0, name='Go', type='go'),

    # 1 — Mediterranean Avenue (brown)
    Square(
        position=1, name='Mediterranean Avenue', type='property',
        price=60, rents=[2, 10, 30, 90, 160, 250],
        house_cost=50, mortgage_value=30, color='brown',
    ),

    # 2 — Community Chest
    Square(position=2, name='Community Chest', type='chest'),

    # 3 — Baltic Avenue (brown)
    Square(
        position=3, name='Baltic Avenue', type='property',
        price=60, rents=[4, 20, 60, 180, 320, 450],
        house_cost=50, mortgage_value=30, color='brown',
    ),

    # 4 — Income Tax
    Square(position=4, name='Income Tax', type='tax', tax_amount=200),

    # 5 — Reading Railroad
    Square(
        position=5, name='Reading Railroad', type='railroad',
        price=200, rents=[25, 50, 100, 200],
        mortgage_value=100,
    ),

    # 6 — Oriental Avenue (light_blue)
    Square(
        position=6, name='Oriental Avenue', type='property',
        price=100, rents=[6, 30, 90, 270, 400, 550],
        house_cost=50, mortgage_value=50, color='light_blue',
    ),

    # 7 — Chance
    Square(position=7, name='Chance', type='chance'),

    # 8 — Vermont Avenue (light_blue)
    Square(
        position=8, name='Vermont Avenue', type='property',
        price=100, rents=[6, 30, 90, 270, 400, 550],
        house_cost=50, mortgage_value=50, color='light_blue',
    ),

    # 9 — Connecticut Avenue (light_blue)
    Square(
        position=9, name='Connecticut Avenue', type='property',
        price=120, rents=[8, 40, 100, 300, 450, 600],
        house_cost=50, mortgage_value=60, color='light_blue',
    ),

    # 10 — Jail / Just Visiting
    Square(position=10, name='Jail / Just Visiting', type='jail'),

    # 11 — St. Charles Place (pink)
    Square(
        position=11, name='St. Charles Place', type='property',
        price=140, rents=[10, 50, 150, 450, 625, 750],
        house_cost=100, mortgage_value=70, color='pink',
    ),

    # 12 — Electric Company (utility)
    Square(
        position=12, name='Electric Company', type='utility',
        price=150, mortgage_value=75,
    ),

    # 13 — States Avenue (pink)
    Square(
        position=13, name='States Avenue', type='property',
        price=140, rents=[10, 50, 150, 450, 625, 750],
        house_cost=100, mortgage_value=70, color='pink',
    ),

    # 14 — Virginia Avenue (pink)
    Square(
        position=14, name='Virginia Avenue', type='property',
        price=160, rents=[12, 60, 180, 500, 700, 900],
        house_cost=100, mortgage_value=80, color='pink',
    ),

    # 15 — Pennsylvania Railroad
    Square(
        position=15, name='Pennsylvania Railroad', type='railroad',
        price=200, rents=[25, 50, 100, 200],
        mortgage_value=100,
    ),

    # 16 — St. James Place (orange)
    Square(
        position=16, name='St. James Place', type='property',
        price=180, rents=[14, 70, 200, 550, 750, 950],
        house_cost=100, mortgage_value=90, color='orange',
    ),

    # 17 — Community Chest
    Square(position=17, name='Community Chest', type='chest'),

    # 18 — Tennessee Avenue (orange)
    Square(
        position=18, name='Tennessee Avenue', type='property',
        price=180, rents=[14, 70, 200, 550, 750, 950],
        house_cost=100, mortgage_value=90, color='orange',
    ),

    # 19 — New York Avenue (orange)
    Square(
        position=19, name='New York Avenue', type='property',
        price=200, rents=[16, 80, 220, 600, 800, 1000],
        house_cost=100, mortgage_value=100, color='orange',
    ),

    # 20 — Free Parking
    Square(position=20, name='Free Parking', type='free_parking'),

    # 21 — Kentucky Avenue (red)
    Square(
        position=21, name='Kentucky Avenue', type='property',
        price=220, rents=[18, 90, 250, 700, 875, 1050],
        house_cost=150, mortgage_value=110, color='red',
    ),

    # 22 — Chance
    Square(position=22, name='Chance', type='chance'),

    # 23 — Indiana Avenue (red)
    Square(
        position=23, name='Indiana Avenue', type='property',
        price=220, rents=[18, 90, 250, 700, 875, 1050],
        house_cost=150, mortgage_value=110, color='red',
    ),

    # 24 — Illinois Avenue (red)
    Square(
        position=24, name='Illinois Avenue', type='property',
        price=240, rents=[20, 100, 300, 750, 925, 1100],
        house_cost=150, mortgage_value=120, color='red',
    ),

    # 25 — B&O Railroad
    Square(
        position=25, name='B&O Railroad', type='railroad',
        price=200, rents=[25, 50, 100, 200],
        mortgage_value=100,
    ),

    # 26 — Atlantic Avenue (yellow)
    Square(
        position=26, name='Atlantic Avenue', type='property',
        price=260, rents=[22, 110, 330, 800, 975, 1150],
        house_cost=150, mortgage_value=130, color='yellow',
    ),

    # 27 — Ventnor Avenue (yellow)
    Square(
        position=27, name='Ventnor Avenue', type='property',
        price=260, rents=[22, 110, 330, 800, 975, 1150],
        house_cost=150, mortgage_value=130, color='yellow',
    ),

    # 28 — Water Works (utility)
    Square(
        position=28, name='Water Works', type='utility',
        price=150, mortgage_value=75,
    ),

    # 29 — Marvin Gardens (yellow)
    Square(
        position=29, name='Marvin Gardens', type='property',
        price=280, rents=[24, 120, 360, 850, 1025, 1200],
        house_cost=150, mortgage_value=140, color='yellow',
    ),

    # 30 — Go To Jail
    Square(position=30, name='Go To Jail', type='go_to_jail'),

    # 31 — Pacific Avenue (green)
    Square(
        position=31, name='Pacific Avenue', type='property',
        price=300, rents=[26, 130, 390, 900, 1100, 1275],
        house_cost=200, mortgage_value=150, color='green',
    ),

    # 32 — North Carolina Avenue (green)
    Square(
        position=32, name='North Carolina Avenue', type='property',
        price=300, rents=[26, 130, 390, 900, 1100, 1275],
        house_cost=200, mortgage_value=150, color='green',
    ),

    # 33 — Community Chest
    Square(position=33, name='Community Chest', type='chest'),

    # 34 — Pennsylvania Avenue (green)
    Square(
        position=34, name='Pennsylvania Avenue', type='property',
        price=320, rents=[28, 150, 450, 1000, 1200, 1400],
        house_cost=200, mortgage_value=160, color='green',
    ),

    # 35 — Short Line Railroad
    Square(
        position=35, name='Short Line Railroad', type='railroad',
        price=200, rents=[25, 50, 100, 200],
        mortgage_value=100,
    ),

    # 36 — Chance
    Square(position=36, name='Chance', type='chance'),

    # 37 — Park Place (dark_blue)
    Square(
        position=37, name='Park Place', type='property',
        price=350, rents=[35, 175, 500, 1100, 1300, 1500],
        house_cost=200, mortgage_value=175, color='dark_blue',
    ),

    # 38 — Luxury Tax
    Square(position=38, name='Luxury Tax', type='tax', tax_amount=100),

    # 39 — Boardwalk (dark_blue)
    Square(
        position=39, name='Boardwalk', type='property',
        price=400, rents=[50, 200, 600, 1400, 1700, 2000],
        house_cost=200, mortgage_value=200, color='dark_blue',
    ),
]

# Verify board length
assert len(BOARD) == 40, f"Expected 40 squares, got {len(BOARD)}"

# Color groups: color -> list of positions
COLOR_GROUPS: dict = {
    'brown':     [1, 3],
    'light_blue': [6, 8, 9],
    'pink':      [11, 13, 14],
    'orange':    [16, 18, 19],
    'red':       [21, 23, 24],
    'yellow':    [26, 27, 29],
    'green':     [31, 32, 34],
    'dark_blue': [37, 39],
    'railroad':  [5, 15, 25, 35],
    'utility':   [12, 28],
}
