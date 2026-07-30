<?php
// backend/modules/socios/_cumple18_cierres_common.php

declare(strict_types=1);

function cumple18Responder(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function cumple18LeerEntrada(): array
{
    $raw = file_get_contents('php://input');

    if ($raw !== false && trim($raw) !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            return $json;
        }
    }

    return $_POST ?: [];
}

function cumple18AsegurarTabla(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS socios_cumpleanios_cierres (
            id_cierre BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            id_socio INT NOT NULL,
            anio SMALLINT UNSIGNED NOT NULL,
            rango VARCHAR(20) NOT NULL DEFAULT '18-23',
            edad_al_cierre TINYINT UNSIGNED DEFAULT NULL,
            fecha_nacimiento DATE DEFAULT NULL,
            cerrado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            cerrado_por_usuario_id INT DEFAULT NULL,
            cerrado_por_nombre VARCHAR(100) DEFAULT NULL,
            origen VARCHAR(30) NOT NULL DEFAULT 'SISTEMA',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id_cierre),
            UNIQUE KEY uq_scc_socio_anio_rango (id_socio, anio, rango),
            KEY idx_scc_anio_rango (anio, rango),
            KEY idx_scc_cerrado_en (cerrado_en),
            CONSTRAINT fk_scc_socio
                FOREIGN KEY (id_socio) REFERENCES socios (id_socio)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci
    ");
}

function cumple18RecuperarDesdeContactos(PDO $pdo, int $anio, string $rango): int
{
    // El dump histórico muestra que los contactos cargados para este flujo
    // corresponden a socios que tenían entre 18 y 23 años al contactarlos.
    // Este INSERT IGNORE permite reconstruir cierres perdidos sin pisar cierres
    // explícitos que ya existan en la tabla nueva.
    if ($rango !== '18-23' || $anio < 2000 || $anio > 2200) {
        return 0;
    }

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO socios_cumpleanios_cierres (
            id_socio,
            anio,
            rango,
            edad_al_cierre,
            fecha_nacimiento,
            cerrado_en,
            cerrado_por_nombre,
            origen
        )
        SELECT
            s.id_socio,
            :anio_insert,
            :rango_insert,
            MIN(TIMESTAMPDIFF(YEAR, s.nacimiento, sc.fecha_contacto)),
            s.nacimiento,
            MIN(sc.created_at),
            'RECUPERADO DEL HISTORIAL DE CONTACTOS',
            'CONTACTO_RECUPERADO'
        FROM socios_contactos sc
        INNER JOIN socios s ON s.id_socio = sc.id_socio
        WHERE YEAR(sc.fecha_contacto) = :anio_filtro
          AND s.nacimiento IS NOT NULL
          AND TIMESTAMPDIFF(YEAR, s.nacimiento, sc.fecha_contacto) BETWEEN 18 AND 23
        GROUP BY s.id_socio, s.nacimiento
    ");

    $stmt->execute([
        ':anio_insert' => $anio,
        ':rango_insert' => $rango,
        ':anio_filtro' => $anio,
    ]);

    return $stmt->rowCount();
}

function cumple18NormalizarRango(?string $rango): string
{
    $valor = trim((string)$rango);
    return $valor !== '' ? mb_substr($valor, 0, 20, 'UTF-8') : '18-23';
}

function cumple18NormalizarFechaHora($valor): ?string
{
    $texto = trim((string)$valor);
    if ($texto === '') {
        return null;
    }

    try {
        $dt = new DateTime($texto);
        return $dt->format('Y-m-d H:i:s');
    } catch (Throwable $e) {
        return null;
    }
}

function cumple18NormalizarFecha($valor): ?string
{
    $texto = trim((string)$valor);
    if ($texto === '') {
        return null;
    }

    $texto = substr($texto, 0, 10);
    $dt = DateTime::createFromFormat('Y-m-d', $texto);
    if (!$dt || $dt->format('Y-m-d') !== $texto) {
        return null;
    }

    return $texto;
}

function cumple18ObtenerActor(array $data): array
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $idSesion = isset($_SESSION['idUsuario']) ? (int)$_SESSION['idUsuario'] : 0;
    $idEntrada = (int)($data['id_usuario'] ?? $data['usuario_id'] ?? 0);
    $nombreEntrada = trim((string)($data['usuario_nombre'] ?? $data['nombre_usuario'] ?? ''));

    return [
        'id' => $idSesion > 0 ? $idSesion : ($idEntrada > 0 ? $idEntrada : null),
        'nombre' => $nombreEntrada !== '' ? mb_substr($nombreEntrada, 0, 100, 'UTF-8') : null,
    ];
}

function cumple18Clave(int $anio, string $rango, int $idSocio): string
{
    return $anio . ':' . $rango . ':' . $idSocio;
}
