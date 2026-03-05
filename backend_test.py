#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class DHPOSAPITester:
    def __init__(self, base_url="https://bistro-checkout-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.outlet_id = None
        self.table_id = None
        self.qr_token = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        
        # Default headers
        default_headers = {'Content-Type': 'application/json'}
        if self.token:
            default_headers['Authorization'] = f'Bearer {self.token}'
        
        # Merge with custom headers if provided
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=default_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list) and len(response_data) > 0:
                        print(f"   Response: Found {len(response_data)} items")
                    elif isinstance(response_data, dict):
                        print(f"   Response keys: {list(response_data.keys())}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (30s)")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login and get token"""
        print("\n" + "="*50)
        print("TESTING ADMIN AUTHENTICATION")
        print("="*50)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@dhpos.com", "password": "Admin@123"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"✅ Token obtained successfully")
            return True
        else:
            print(f"❌ Failed to get access token")
            return False

    def test_get_outlets(self):
        """Test getting outlets"""
        print("\n" + "="*50)
        print("TESTING OUTLETS API")
        print("="*50)
        
        success, response = self.run_test(
            "Get Outlets",
            "GET",
            "api/admin/outlets",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            self.outlet_id = response[0]['id']
            print(f"✅ Found outlet: {response[0]['name']} (ID: {self.outlet_id})")
            return True
        else:
            print(f"❌ No outlets found or invalid response")
            return False

    def test_get_tables(self):
        """Test getting tables for outlet"""
        if not self.outlet_id:
            print("❌ Cannot test tables - no outlet_id available")
            return False
            
        print("\n" + "="*50)
        print("TESTING TABLES API")
        print("="*50)
        
        success, response = self.run_test(
            "Get Tables",
            "GET",
            f"api/admin/tables/{self.outlet_id}",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            self.table_id = response[0]['id']
            self.qr_token = response[0]['qr_token']
            print(f"✅ Found table: {response[0]['table_number']} (ID: {self.table_id})")
            print(f"   QR Token: {self.qr_token}")
            return True
        else:
            print(f"❌ No tables found or invalid response")
            return False

    def test_get_menu(self):
        """Test getting menu for outlet"""
        if not self.outlet_id:
            print("❌ Cannot test menu - no outlet_id available")
            return False
            
        print("\n" + "="*50)
        print("TESTING MENU API")
        print("="*50)
        
        success, response = self.run_test(
            "Get Menu",
            "GET",
            f"api/menu/{self.outlet_id}",
            200
        )
        
        if success and isinstance(response, list):
            total_items = sum(len(category.get('items', [])) for category in response)
            print(f"✅ Found {len(response)} categories with {total_items} total items")
            return True
        else:
            print(f"❌ Invalid menu response")
            return False

    def test_get_qr_codes(self):
        """Test getting QR codes for tables"""
        if not self.outlet_id:
            print("❌ Cannot test QR codes - no outlet_id available")
            return False
            
        print("\n" + "="*50)
        print("TESTING QR CODES API")
        print("="*50)
        
        success, response = self.run_test(
            "Get QR Codes",
            "GET",
            f"api/admin/tables/{self.outlet_id}/qr-codes",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            print(f"✅ Found QR codes for {len(response)} tables")
            for qr in response[:2]:  # Show first 2
                print(f"   Table {qr['table_number']}: {qr['qr_url']}")
            return True
        else:
            print(f"❌ No QR codes found or invalid response")
            return False

    def test_get_dashboard(self):
        """Test getting dashboard stats"""
        if not self.outlet_id:
            print("❌ Cannot test dashboard - no outlet_id available")
            return False
            
        print("\n" + "="*50)
        print("TESTING DASHBOARD API")
        print("="*50)
        
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            f"api/admin/dashboard/{self.outlet_id}",
            200
        )
        
        if success and isinstance(response, dict):
            print(f"✅ Dashboard data retrieved:")
            print(f"   Today's Revenue: ${response.get('todays_revenue', 0)}")
            print(f"   Today's Orders: {response.get('todays_orders', 0)}")
            print(f"   Active Tables: {response.get('active_tables', 0)}")
            print(f"   Top Items: {len(response.get('top_items', []))}")
            return True
        else:
            print(f"❌ Invalid dashboard response")
            return False

    def test_qr_info(self):
        """Test QR token info endpoint"""
        if not self.qr_token:
            print("❌ Cannot test QR info - no qr_token available")
            return False
            
        print("\n" + "="*50)
        print("TESTING QR INFO API")
        print("="*50)
        
        success, response = self.run_test(
            "Get QR Info",
            "GET",
            f"api/qr/{self.qr_token}",
            200
        )
        
        if success and isinstance(response, dict):
            print(f"✅ QR info retrieved:")
            print(f"   Table: {response.get('table', {}).get('table_number', 'N/A')}")
            print(f"   Outlet: {response.get('outlet', {}).get('name', 'N/A')}")
            print(f"   Menu Categories: {len(response.get('menu', []))}")
            return True
        else:
            print(f"❌ Invalid QR info response")
            return False

    def test_live_orders(self):
        """Test live orders endpoint"""
        if not self.outlet_id:
            print("❌ Cannot test live orders - no outlet_id available")
            return False
            
        print("\n" + "="*50)
        print("TESTING LIVE ORDERS API")
        print("="*50)
        
        success, response = self.run_test(
            "Get Live Orders",
            "GET",
            f"api/admin/live-orders/{self.outlet_id}",
            200
        )
        
        if success and isinstance(response, list):
            print(f"✅ Live orders retrieved: {len(response)} active orders")
            return True
        else:
            print(f"❌ Invalid live orders response")
            return False

def main():
    print("🚀 Starting DH POS API Testing")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = DHPOSAPITester()
    
    # Test sequence - each test depends on previous ones
    tests = [
        ("Admin Login", tester.test_admin_login),
        ("Get Outlets", tester.test_get_outlets),
        ("Get Tables", tester.test_get_tables),
        ("Get Menu", tester.test_get_menu),
        ("Get QR Codes", tester.test_get_qr_codes),
        ("Get Dashboard", tester.test_get_dashboard),
        ("QR Info", tester.test_qr_info),
        ("Live Orders", tester.test_live_orders),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
                # Continue with other tests even if one fails
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print("\n" + "="*60)
    print("FINAL TEST RESULTS")
    print("="*60)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())