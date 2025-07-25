<?php
// backend/config/db.php
// Configuración de la base de datos
//brunoball516
//Gastex2233
//php -S localhost:3001 -c "C:\PHP\php1\php.ini"

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
