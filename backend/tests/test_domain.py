from decimal import Decimal
import pytest
from app.domain import bill,meter_quantity,distance,optimize

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

def test_route_preserves_commitments_and_calculates_savings():
    jobs=[{'id':'a','point':(30,75.01),'earliest':480,'latest_start':480,'duration':60}, {'id':'b','point':(30,75.02),'earliest':600,'latest_start':600,'duration':60}]
    r=optimize((30,75),jobs)
    assert r['feasible'] and [s['start_minute'] for s in r['stops']]==[480,600]
    assert r['saved_km']>0 and r['estimated_km']<r['baseline_km']
def test_infeasible_route_is_not_faked():
    jobs=[{'id':'a','point':(30,76),'earliest':480,'latest_start':480,'duration':120}, {'id':'b','point':(30,77),'earliest':500,'latest_start':500,'duration':60}]
    assert not optimize((30,75),jobs)['feasible']
def test_solver_limit():
    with pytest.raises(ValueError):optimize((30,75),[])

def test_bill_with_attachments_and_fuel_addon():
    # Base 650/hr + 200/hr (Rotavator) + 150/hr (Diesel) = 1000/hr * 3 hrs + 250 mob = 3250.00
    res = bill('650', '3.0', '250', addons_rate='350')
    assert res['base_rental'] == Decimal('1950.00')
    assert res['addons'] == Decimal('1050.00')
    assert res['rental'] == Decimal('3000.00')
    assert res['mobilization'] == Decimal('250.00')
    assert res['total'] == Decimal('3250.00')
