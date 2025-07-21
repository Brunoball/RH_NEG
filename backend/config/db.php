<?php
// backend/config/db.php

$host = 'localhost';
$dbname = 'rh_neg';
$user = 'root'; // Cambialo si usás otro usuario
$pass = 'brunoball516'; // Cambialo si tenés contraseña

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die(json_encode([
        'exito' => false,
        'mensaje' => 'Error de conexión a la base de datos: ' . $e->getMessage()
    ]));
}
