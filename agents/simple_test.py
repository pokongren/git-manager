#!/usr/bin/env python3
"""
Simple Agent Test Script - ASCII only
"""

import sys
import os
import json
import requests
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

API_BASE = "http://localhost:8765"
TEST_REPO = r"F:\Program Files\Git\git-manager"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def api_call(method, endpoint, data=None):
    """Call API and return result"""
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        else:
            response = requests.post(url, json=data or {}, headers={"Content-Type": "application/json"}, timeout=10)
        
        return {
            "success": response.status_code == 200,
            "status": response.status_code,
            "data": response.json() if response.status_code == 200 else None,
            "error": response.text if response.status_code != 200 else None
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot connect to backend"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def test_port():
    """Test if port is open"""
    log("Testing port 8765...")
    result = api_call("GET", "/api/repo/info")
    if result["success"]:
        log("Port 8765 is OPEN - Backend is running")
        return True
    else:
        log(f"Port test failed: {result.get('error', 'Unknown error')}")
        return False

def test_workflow():
    """Test full workflow"""
    log("=" * 60)
    log("Starting Multi-Agent Test")
    log("=" * 60)
    
    results = []
    
    # Step 1: Connect repo
    log("[AGENT-1: Worker] Step 1: Connect repo")
    r = api_call("POST", "/api/repo/open", {"path": TEST_REPO})
    results.append(("connect", r["success"]))
    log(f"  Result: {'OK' if r['success'] else 'FAIL'} - {r.get('data', {}).get('path', r.get('error', 'N/A'))}")
    
    if not r["success"]:
        log("Cannot continue without repo connection")
        return results
    
    # Step 2: Check status
    log("[AGENT-1: Worker] Step 2: Check status")
    r = api_call("GET", "/api/status")
    results.append(("status", r["success"]))
    if r["success"]:
        files = r.get("data", {}).get("files", [])
        log(f"  Result: OK - {len(files)} files changed")
    else:
        log(f"  Result: FAIL - {r.get('error', 'Unknown')}")
    
    # Step 3: Stage files
    log("[AGENT-1: Worker] Step 3: Stage files")
    r = api_call("POST", "/api/stage", {})
    results.append(("stage", r["success"]))
    log(f"  Result: {'OK' if r['success'] else 'FAIL'}")
    
    # Step 4: Create branch
    branch_name = f"agent-test-{int(datetime.now().timestamp())}"
    log(f"[AGENT-1: Worker] Step 4: Create branch '{branch_name}'")
    r = api_call("POST", "/api/branches/create", {"name": branch_name, "source": None})
    results.append(("create_branch", r["success"]))
    log(f"  Result: {'OK' if r['success'] else 'FAIL'}")
    
    # Step 5: Create backup
    tag_name = f"agent-backup-{int(datetime.now().timestamp())}"
    log(f"[AGENT-1: Worker] Step 5: Create backup '{tag_name}'")
    r = api_call("POST", "/api/backup/create", {"tag_name": tag_name, "message": "Agent auto backup"})
    results.append(("create_backup", r["success"]))
    log(f"  Result: {'OK' if r['success'] else 'FAIL'}")
    
    # Step 6: Switch back to master
    log("[AGENT-1: Worker] Step 6: Switch to master")
    r = api_call("POST", "/api/branches/switch", {"name": "master"})
    results.append(("switch_branch", r["success"]))
    log(f"  Result: {'OK' if r['success'] else 'FAIL'}")
    
    # AGENT-2: Tester
    log("")
    log("=" * 60)
    log("[AGENT-2: Tester] Testing API endpoints")
    log("=" * 60)
    
    findings = []
    
    # Test without repo
    log("Test: API without repo connection")
    # First, we need to test with a fresh session - skip for now
    
    # Test invalid branch name
    log("Test: Invalid branch name 'test~invalid'")
    r = api_call("POST", "/api/branches/create", {"name": "test~invalid"})
    if r["success"]:
        findings.append("ALLOWED_INVALID_BRANCH_NAME")
        log("  Finding: System allows invalid branch names!")
    else:
        log("  OK: Rejected invalid branch name")
    
    # Test duplicate tag
    log(f"Test: Duplicate tag '{tag_name}'")
    r = api_call("POST", "/api/backup/create", {"tag_name": tag_name, "message": "Duplicate"})
    if r["success"]:
        findings.append("ALLOWED_DUPLICATE_TAG")
        log("  Finding: System allows duplicate backup tags!")
    else:
        log("  OK: Rejected duplicate tag")
    
    # AGENT-3: Logger
    log("")
    log("=" * 60)
    log("[AGENT-3: Logger] Generating report")
    log("=" * 60)
    
    success_count = sum(1 for _, success in results if success)
    total_count = len(results)
    
    log(f"Total operations: {total_count}")
    log(f"Successful: {success_count}")
    log(f"Failed: {total_count - success_count}")
    log(f"Success rate: {success_count/total_count*100:.1f}%")
    
    if findings:
        log(f"\nFindings: {len(findings)} issues found")
        for f in findings:
            log(f"  - {f}")
    else:
        log("\nNo issues found")
    
    # Save report
    os.makedirs("logs", exist_ok=True)
    report = {
        "timestamp": datetime.now().isoformat(),
        "repo": TEST_REPO,
        "operations": [{"step": s, "success": ok} for s, ok in results],
        "summary": {
            "total": total_count,
            "success": success_count,
            "failed": total_count - success_count,
            "rate": f"{success_count/total_count*100:.1f}%"
        },
        "findings": findings
    }
    
    report_file = f"logs/agent_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    log(f"\nReport saved to: {report_file}")
    
    # AGENT-4: Improver - Generate suggestions
    log("")
    log("=" * 60)
    log("[AGENT-4: Improver] Generating improvements")
    log("=" * 60)
    
    improvements = []
    
    if "ALLOWED_INVALID_BRANCH_NAME" in findings:
        improvements.append({
            "priority": "HIGH",
            "title": "Add branch name validation",
            "description": "System should reject branch names with illegal characters like ~, ^, :, etc."
        })
    
    if "ALLOWED_DUPLICATE_TAG" in findings:
        improvements.append({
            "priority": "HIGH", 
            "title": "Check for duplicate backup tags",
            "description": "System should warn before overwriting existing backup tags"
        })
    
    # Always add some UI improvements
    improvements.extend([
        {
            "priority": "MEDIUM",
            "title": "Add global loading state",
            "description": "Show loading spinner during Git operations to prevent double-clicks"
        },
        {
            "priority": "MEDIUM",
            "title": "Add operation history panel",
            "description": "Show recent operations in a panel for user reference"
        },
        {
            "priority": "LOW",
            "title": "Add Pull/Push functionality",
            "description": "Support remote repository operations"
        }
    ])
    
    log(f"Generated {len(improvements)} improvement suggestions:")
    for i, imp in enumerate(improvements, 1):
        log(f"  {i}. [{imp['priority']}] {imp['title']}")
        log(f"     {imp['description']}")
    
    # Save improvements
    imp_file = f"logs/improvements_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(imp_file, 'w') as f:
        json.dump(improvements, f, indent=2)
    
    log(f"\nImprovements saved to: {imp_file}")
    
    log("")
    log("=" * 60)
    log("Multi-Agent test completed!")
    log("=" * 60)
    
    return results

def main():
    print("=" * 70)
    print("Git UI Multi-Agent Test System")
    print("=" * 70)
    print(f"\nConfig:")
    print(f"  Test repo: {TEST_REPO}")
    print(f"  API base: {API_BASE}")
    print()
    
    # Test port first
    if not test_port():
        print("\nERROR: Backend not running!")
        print("Please start it first: python backend/main.py")
        return 1
    
    # Run workflow
    try:
        test_workflow()
        return 0
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        return 1
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
