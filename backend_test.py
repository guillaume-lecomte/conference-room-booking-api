#!/usr/bin/env python3
"""
Conference Room Booking API Backend Test Suite
"""

import requests
import json
import sys
import time
import uuid
from datetime import datetime, timedelta

class APITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.room_ids = [
            "550e8400-e29b-41d4-a716-446655440001",  # Salle Einstein
            "550e8400-e29b-41d4-a716-446655440002",  # Salle Curie  
            "550e8400-e29b-41d4-a716-446655440003"   # Salle Newton
        ]
        self.created_bookings = []

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {"text": response.text}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    return False, response.json()
                except:
                    return False, {"text": response.text}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {"error": str(e)}

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test("Health Check", "GET", "health")
        return success and response.get('status') == 'healthy'

    def test_rooms_list(self):
        """Test rooms list"""
        success, response = self.run_test("List Rooms", "GET", "rooms")
        if success and response.get('status') == 'success':
            rooms = response.get('data', [])
            print(f"Found {len(rooms)} rooms")
            return len(rooms) >= 3
        return False

    def test_room_availability(self):
        """Test room availability"""
        room_id = self.room_ids[0]
        today = datetime.now().strftime('%Y-%m-%d')
        success, response = self.run_test(
            "Room Availability", 
            "GET", 
            f"rooms/{room_id}/availability?date={today}"
        )
        return success and response.get('status') == 'success'

    def test_create_booking(self):
        """Test booking creation"""
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        
        booking_data = {
            "roomId": self.room_ids[0],
            "userId": f"test-user-{int(time.time())}",
            "title": f"Test Meeting {int(time.time())}",
            "description": "Test booking",
            "startTime": start_time.isoformat() + "Z",
            "endTime": end_time.isoformat() + "Z"
        }
        
        success, response = self.run_test(
            "Create Booking", 
            "POST", 
            "bookings", 
            expected_status=201,
            data=booking_data
        )
        
        if success and response.get('status') == 'success':
            booking_id = response.get('data', {}).get('id')
            if booking_id:
                self.created_bookings.append(booking_id)
                return booking_id
        return None

    def test_idempotency(self):
        """Test idempotency"""
        idempotency_key = f"test-key-{uuid.uuid4()}"
        start_time = datetime.now() + timedelta(hours=2)
        end_time = start_time + timedelta(hours=1)
        
        booking_data = {
            "roomId": self.room_ids[1],
            "userId": f"test-user-{int(time.time())}",
            "title": "Idempotency Test",
            "description": "Test idempotency",
            "startTime": start_time.isoformat() + "Z",
            "endTime": end_time.isoformat() + "Z"
        }
        
        headers = {'Idempotency-Key': idempotency_key}
        
        # First request
        success1, response1 = self.run_test(
            "Idempotency Test 1", 
            "POST", 
            "bookings", 
            expected_status=201,
            data=booking_data,
            headers=headers
        )
        
        # Second request with same key
        success2, response2 = self.run_test(
            "Idempotency Test 2", 
            "POST", 
            "bookings", 
            expected_status=201,
            data=booking_data,
            headers=headers
        )
        
        if success1 and success2:
            booking1_id = response1.get('data', {}).get('id')
            booking2_id = response2.get('data', {}).get('id')
            
            if booking1_id == booking2_id:
                if booking1_id:
                    self.created_bookings.append(booking1_id)
                print("✅ Idempotency working - same booking returned")
                return True
            else:
                print("❌ Idempotency failed - different bookings returned")
                return False
        return False

    def test_get_booking(self, booking_id):
        """Test get booking"""
        success, response = self.run_test(
            "Get Booking", 
            "GET", 
            f"bookings/{booking_id}"
        )
        return success and response.get('data', {}).get('id') == booking_id

    def test_cancel_booking(self, booking_id):
        """Test cancel booking"""
        success, response = self.run_test(
            "Cancel Booking", 
            "PUT", 
            f"bookings/{booking_id}/cancel",
            data={"reason": "Test cancellation"}
        )
        return success and response.get('data', {}).get('status') == 'CANCELLED'

    def test_conflict_detection(self):
        """Test conflict detection"""
        start_time = datetime.now() + timedelta(hours=3)
        end_time = start_time + timedelta(hours=1)
        
        booking_data = {
            "roomId": self.room_ids[2],
            "userId": f"test-user-{int(time.time())}",
            "title": "Conflict Test 1",
            "description": "First booking",
            "startTime": start_time.isoformat() + "Z",
            "endTime": end_time.isoformat() + "Z"
        }
        
        # Create first booking
        success1, response1 = self.run_test(
            "Create First Booking", 
            "POST", 
            "bookings", 
            expected_status=201,
            data=booking_data
        )
        
        if success1:
            booking_id = response1.get('data', {}).get('id')
            if booking_id:
                self.created_bookings.append(booking_id)
            
            # Try conflicting booking
            booking_data['title'] = "Conflict Test 2"
            booking_data['userId'] = f"test-user-{int(time.time())}-2"
            
            success2, response2 = self.run_test(
                "Conflict Detection", 
                "POST", 
                "bookings", 
                expected_status=409,
                data=booking_data
            )
            return success2
        return False

    def test_validation_errors(self):
        """Test validation errors"""
        invalid_data = {
            "roomId": "invalid-uuid",
            "userId": "",
            "title": "",
            "startTime": "invalid-date",
            "endTime": "invalid-date"
        }
        
        success, response = self.run_test(
            "Validation Errors", 
            "POST", 
            "bookings", 
            expected_status=400,
            data=invalid_data
        )
        return success

    def cleanup(self):
        """Cleanup test bookings"""
        print(f"\n🧹 Cleaning up {len(self.created_bookings)} test bookings...")
        for booking_id in self.created_bookings:
            try:
                self.run_test(
                    "Cleanup", 
                    "PUT", 
                    f"bookings/{booking_id}/cancel",
                    data={"reason": "Test cleanup"}
                )
            except:
                pass

def main():
    tester = APITester()
    
    print("🚀 Starting Conference Room Booking API Tests")
    
    try:
        # Basic tests
        if not tester.test_health():
            print("❌ Health check failed - stopping tests")
            return 1
        
        if not tester.test_rooms_list():
            print("❌ Rooms list failed - stopping tests")
            return 1
        
        # Core functionality tests
        tester.test_room_availability()
        
        booking_id = tester.test_create_booking()
        tester.test_idempotency()
        
        if booking_id:
            tester.test_get_booking(booking_id)
            tester.test_cancel_booking(booking_id)
        
        tester.test_conflict_detection()
        tester.test_validation_errors()
        
        # Cleanup
        tester.cleanup()
        
        # Summary
        print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
        success_rate = (tester.tests_passed / tester.tests_run) * 100
        print(f"Success rate: {success_rate:.1f}%")
        
        return 0 if tester.tests_passed == tester.tests_run else 1
        
    except Exception as e:
        print(f"💥 Error: {e}")
        tester.cleanup()
        return 1

if __name__ == "__main__":
    sys.exit(main())