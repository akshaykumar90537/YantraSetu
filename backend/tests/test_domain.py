from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytest
from app.domain import bill, meter_quantity, distance, find_next_available_slot

def test_hourly_price():
    assert bill('650','2.5','250')['total']==Decimal('1875.00')
def test_acre_price():
    assert bill('1200','3.25','250')['total']==Decimal('4150.00')
def test_half_paise_rounds_up():
    assert bill('0.01','0.5','0')['total']==Decimal('0.01')
@pytest.mark.parametrize('args',[('-1','2','0'),('10','0','0'),('10','1','-1')])
def test_invalid_bill(args):
    with pytest.raises(ValueError):bill(*args)
def test_meter_decimal():
    assert meter_quantity('987.125','989.375')==Decimal('2.250')
@pytest.mark.parametrize('start,end',[('2','1'),('2','2'),('-1','2')])
def test_bad_meter(start,end):
    with pytest.raises(ValueError):meter_quantity(start,end)
def test_distance_zero():assert distance((30,75),(30,75))==0

def test_bill_with_attachments_and_fuel_addon():
    # Base 650/hr + 200/hr (Rotavator) + 150/hr (Diesel) = 1000/hr * 3 hrs + 250 mob = 3250.00
    res = bill('650', '3.0', '250', addons_rate='350')
    assert res['base_rental'] == Decimal('1950.00')
    assert res['addons'] == Decimal('1050.00')
    assert res['rental'] == Decimal('3000.00')
    assert res['mobilization'] == Decimal('250.00')
    assert res['total'] == Decimal('3250.00')

def test_find_next_available_slot_respects_turnaround_buffer():
    now = datetime(2026, 10, 30, 8, 0, tzinfo=timezone.utc)
    # Existing job at 10:00 to 12:00, reserved until 12:15
    busy = [{'start_at': datetime(2026, 10, 30, 10, 0, tzinfo=timezone.utc), 'reserved_until': datetime(2026, 10, 30, 12, 15, tzinfo=timezone.utc)}]
    # A 120-min job starting at 8:15 ends at 10:15 with 15-min buffer = 10:30 (overlaps with 10:00).
    # It must not fit before 10:00; it must be scheduled after 12:15.
    slot = find_next_available_slot(datetime(2026, 10, 30, 8, 15, tzinfo=timezone.utc), busy, buffer_minutes=15, duration_minutes=120)
    assert slot['start_at'] == '2026-10-30T12:15:00+00:00'
    assert slot['end_at'] == '2026-10-30T14:15:00+00:00'

def test_find_next_available_slot_fits_when_buffer_clears():
    now = datetime(2026, 10, 30, 7, 0, tzinfo=timezone.utc)
    # Existing job at 10:00 to 12:00
    busy = [{'start_at': datetime(2026, 10, 30, 10, 0, tzinfo=timezone.utc), 'reserved_until': datetime(2026, 10, 30, 12, 15, tzinfo=timezone.utc)}]
    # A 120-min job at 7:00 rounds to 7:15, ends at 9:15 + 15m buffer = 9:30 <= 10:00. Fits!
    slot = find_next_available_slot(now, busy, buffer_minutes=15, duration_minutes=120)
    assert slot['start_at'] == '2026-10-30T07:15:00+00:00'
    assert slot['end_at'] == '2026-10-30T09:15:00+00:00'

from app.domain import validate_booking_interval
from app.main import Machine
from pydantic import ValidationError

def test_booking_validation_rejects_past_start():
    now = datetime(2026, 10, 30, 14, 0, tzinfo=timezone.utc)
    past_start = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 29, 14, 0, tzinfo=timezone.utc)
    with pytest.raises(ValueError, match="Booking start time cannot be in the past."):
        validate_booking_interval(past_start, end, now=now)

def test_booking_validation_rejects_end_before_or_equal_start():
    now = datetime(2026, 10, 30, 10, 0, tzinfo=timezone.utc)
    start = datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)
    # End before start
    end_before = datetime(2026, 10, 30, 11, 0, tzinfo=timezone.utc)
    with pytest.raises(ValueError, match="Booking end time must be after start time."):
        validate_booking_interval(start, end_before, now=now)
    # End equal to start
    with pytest.raises(ValueError, match="Booking end time must be after start time."):
        validate_booking_interval(start, start, now=now)

def test_booking_validation_rejects_duration_under_30_minutes():
    now = datetime(2026, 10, 30, 10, 0, tzinfo=timezone.utc)
    start = datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)
    end_20m = datetime(2026, 10, 30, 12, 20, tzinfo=timezone.utc)
    with pytest.raises(ValueError, match="Booking duration must be at least 30 minutes."):
        validate_booking_interval(start, end_20m, now=now)

def test_booking_validation_accepts_valid_slots():
    now = datetime(2026, 10, 30, 10, 0, tzinfo=timezone.utc)
    start = datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)
    # Exactly 30 minutes
    validate_booking_interval(start, start + timedelta(minutes=30), now=now)
    # 2 hours
    validate_booking_interval(start, start + timedelta(hours=2), now=now)

def test_machine_constraints_require_positive_rate_and_valid_attributes():
    # Negative rate rejected
    with pytest.raises(ValidationError):
        Machine(name="Mahindra Tractor", category="Tractor", model="575 DI", village="Khanna", latitude=30.9, longitude=75.8, rate=Decimal("-100"))
    # Zero rate rejected
    with pytest.raises(ValidationError):
        Machine(name="Mahindra Tractor", category="Tractor", model="575 DI", village="Khanna", latitude=30.9, longitude=75.8, rate=Decimal("0"))
    # Negative buffer rejected
    with pytest.raises(ValidationError):
        Machine(name="Mahindra Tractor", category="Tractor", model="575 DI", village="Khanna", latitude=30.9, longitude=75.8, rate=Decimal("500"), buffer_minutes=-5)
    # Negative mobilization rejected
    with pytest.raises(ValidationError):
        Machine(name="Mahindra Tractor", category="Tractor", model="575 DI", village="Khanna", latitude=30.9, longitude=75.8, rate=Decimal("500"), mobilization=Decimal("-50"))
    # Negative fuel surcharge rejected
    with pytest.raises(ValidationError):
        Machine(name="Mahindra Tractor", category="Tractor", model="575 DI", village="Khanna", latitude=30.9, longitude=75.8, rate=Decimal("500"), fuel_rate_extra=Decimal("-20"))

def test_machine_text_fields_trimmed_and_reject_empty_or_whitespace():
    # Whitespace-only name rejected
    with pytest.raises(ValidationError):
        Machine(name="    ", category="Tractor", model="575 DI", village="Khanna", latitude=30.9, longitude=75.8, rate=Decimal("600"))
    # Whitespace-only model rejected
    with pytest.raises(ValidationError):
        Machine(name="Mahindra 575 DI", category="Tractor", model="   ", village="Khanna", latitude=30.9, longitude=75.8, rate=Decimal("600"))
    # Whitespace-only village rejected
    with pytest.raises(ValidationError):
        Machine(name="Mahindra 575 DI", category="Tractor", model="575 DI", village="   ", latitude=30.9, longitude=75.8, rate=Decimal("600"))
    # Valid machine trims leading/trailing spaces
    m = Machine(name="  Mahindra Tractor  ", category="  Tractor  ", model="  575 DI XP  ", village="  Khanna  ", latitude=30.9, longitude=75.8, rate=Decimal("750.50"))
    assert m.name == "Mahindra Tractor"
    assert m.category == "Tractor"
    assert m.model == "575 DI XP"
    assert m.village == "Khanna"
    assert m.rate == Decimal("750.50")


