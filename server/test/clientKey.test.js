// Rate-limit keys: IPv4 addresses as they are, IPv6 grouped by their first
// 56 bits so one device can't hop between its addresses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientKey } from "../clientKey.js";

const key = (ip) => clientKey({ ip });

test("IPv4 addresses, and IPv4 written as IPv6, are kept as they are", () => {
  assert.equal(key("203.0.113.9"), "203.0.113.9");
  assert.equal(key("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(key(undefined), "");
});

test("IPv6 addresses in one /56 share a key", () => {
  const home = key("2001:db8:1:2::1");
  assert.equal(home, "2001:db8:1:0::/56");
  for (const ip of ["2001:db8:1:3::c", "2001:0db8:0001:00ff:0000:0000:0000:0001", "2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::1%eth0"]) {
    assert.equal(key(ip), home, ip);
  }
  assert.notEqual(key("2001:db8:1:100::1"), home);
  assert.notEqual(key("2001:db8:2:2::1"), home);
  assert.equal(key("::1"), "0:0:0:0::/56");
});
