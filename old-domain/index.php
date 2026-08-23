<?php
/**
 * ECOWOODS — ecowoodshardwood.com → ecowoods.ca
 *
 * LAST RESORT ONLY. Use this when the host gives no access to server config
 * and .htaccess is ignored — some shared and managed-WordPress hosts.
 *
 * It is worse than a server-level redirect: PHP has to boot to answer, so it
 * is slower, and it only fires for requests that reach this file. A request
 * for /old-page.html that resolves to a real file on disk will be served
 * instead of redirected. Delete every other file in the document root, or this
 * leaks pages.
 *
 * If the host supports .htaccess at all, use that instead and delete this.
 */
$path  = $_SERVER['REQUEST_URI'] ?? '/';
$target = 'https://ecowoods.ca' . $path;

header('HTTP/1.1 301 Moved Permanently');
header('Location: ' . $target, true, 301);
header('Cache-Control: max-age=3600');
exit;
