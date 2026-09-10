-- =============================================================================
-- Servicios de Altura — esquema de la aplicación
-- Convención de nombres tomada de tapioki-pos (tblXxx / IdXxx / PascalCase),
-- con AUTO_INCREMENT y llaves foráneas reales.
-- MySQL 8 · InnoDB · utf8mb4
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `BDServiciosAltura`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `BDServiciosAltura`;

-- =============================================================================
-- CATÁLOGOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS `tblUsuarios` (
  `IdUsuario`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Usuario`       VARCHAR(120) NOT NULL COMMENT 'Nombre completo',
  `Login`         VARCHAR(40)  NOT NULL,
  `ClaveHash`     VARCHAR(100) NOT NULL COMMENT 'bcrypt',
  `Perfil`        ENUM('administrador','ventas','operaciones','campo') NOT NULL DEFAULT 'ventas',
  `EsVendedor`    TINYINT(1)   NOT NULL DEFAULT 0,
  `ComisionPct`   DECIMAL(5,2) NOT NULL DEFAULT 4.00 COMMENT 'Comisión sobre utilidad bruta',
  `Correo`        VARCHAR(160) NULL,
  `Status`        TINYINT(1)   NOT NULL DEFAULT 1,
  `FechaAlta`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UltimoAcceso`  DATETIME     NULL,
  PRIMARY KEY (`IdUsuario`),
  UNIQUE KEY `uq_login` (`Login`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblClientes` (
  `IdCliente`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Cliente`     VARCHAR(200) NOT NULL,
  `Planta`      VARCHAR(200) NULL COMMENT 'Sede o sucursal',
  `Rfc`         VARCHAR(13)  NULL,
  `Contacto`    VARCHAR(160) NULL,
  `Correo`      VARCHAR(160) NULL,
  `Telefono`    VARCHAR(40)  NULL,
  `Direccion`   VARCHAR(255) NULL,
  `Ciudad`      VARCHAR(120) NULL,
  `Status`      TINYINT(1)   NOT NULL DEFAULT 1,
  `FechaAlta`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdCliente`),
  KEY `idx_cliente` (`Cliente`)
) ENGINE=InnoDB;

-- Tarifas por puesto: la fuente de verdad de nómina, IMSS, desgaste y precio de venta.
CREATE TABLE IF NOT EXISTS `tblPuestos` (
  `IdPuesto`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Puesto`          VARCHAR(60)  NOT NULL,
  `Abreviatura`     VARCHAR(12)  NOT NULL,
  `SalarioDiario`   DECIMAL(12,2) NOT NULL DEFAULT 0,
  `ImssDiario`      DECIMAL(12,2) NOT NULL DEFAULT 0,
  `DesgasteDiario`  DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Desgaste de equipo por día',
  `BonoDefault`     DECIMAL(12,2) NOT NULL DEFAULT 0,
  `TarifaVentaDia`  DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Precio de venta por persona-día',
  `Orden`           SMALLINT     NOT NULL DEFAULT 0,
  `Status`          TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`IdPuesto`),
  UNIQUE KEY `uq_puesto` (`Puesto`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblEmpleados` (
  `IdEmpleado`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Empleado`       VARCHAR(160) NOT NULL,
  `IdPuesto`       INT UNSIGNED NOT NULL,
  `SalarioDiario`  DECIMAL(12,2) NULL COMMENT 'NULL = usa la del puesto',
  `ImssDiario`     DECIMAL(12,2) NULL,
  `DesgasteDiario` DECIMAL(12,2) NULL,
  `Telefono`       VARCHAR(40)  NULL,
  `Status`         TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`IdEmpleado`),
  KEY `idx_puesto` (`IdPuesto`),
  CONSTRAINT `fk_emp_puesto` FOREIGN KEY (`IdPuesto`) REFERENCES `tblPuestos` (`IdPuesto`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblInsumos` (
  `IdInsumo`       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Insumo`         VARCHAR(255) NOT NULL,
  `Unidad`         VARCHAR(30)  NOT NULL DEFAULT 'PZA',
  `CostoUnitario`  DECIMAL(12,2) NOT NULL DEFAULT 0,
  `EsHerramental`  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '0 = insumo consumible, 1 = herramental',
  `Status`         TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`IdInsumo`),
  KEY `idx_insumo` (`Insumo`)
) ENGINE=InnoDB;

-- Porcentajes y constantes del costeo. Se leen al crear el costeo y se congelan ahí.
CREATE TABLE IF NOT EXISTS `tblParametros` (
  `IdParametro` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Clave`       VARCHAR(40)  NOT NULL,
  `Valor`       DECIMAL(14,4) NOT NULL,
  `Descripcion` VARCHAR(200) NOT NULL,
  PRIMARY KEY (`IdParametro`),
  UNIQUE KEY `uq_clave` (`Clave`)
) ENGINE=InnoDB;

-- Hoja "Tabla de montos": escalones de EPP y compra de equipo según el monto de venta.
CREATE TABLE IF NOT EXISTS `tblTarifasMonto` (
  `IdTarifaMonto` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Tipo`          ENUM('EPP','EQUIPO') NOT NULL,
  `MontoHasta`    DECIMAL(14,2) NOT NULL,
  `Costo`         DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`IdTarifaMonto`),
  UNIQUE KEY `uq_tipo_monto` (`Tipo`,`MontoHasta`)
) ENGINE=InnoDB;

-- =============================================================================
-- LEVANTAMIENTO
-- =============================================================================

CREATE TABLE IF NOT EXISTS `tblLevantamientos` (
  `IdLevantamiento` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Folio`           INT UNSIGNED NOT NULL COMMENT 'Folio de la hoja de levantamiento (3434)',
  `IdCliente`       INT UNSIGNED NOT NULL,
  `Proyecto`        VARCHAR(500) NOT NULL,
  `AreaTrabajo`     VARCHAR(300) NULL,
  `UsuarioContacto` VARCHAR(160) NULL COMMENT 'Usuario del cliente: PADRE JAVIER LOZANO',
  `CorreoUsuario`   VARCHAR(160) NULL,
  `IdResponsable`   INT UNSIGNED NULL COMMENT 'Usuario responsable del levantamiento',
  `Fecha`           DATE         NOT NULL,
  `NivelRiesgo`     ENUM('BAJO','MEDIO','ALTO') NOT NULL DEFAULT 'ALTO',
  `Dias`            SMALLINT     NOT NULL DEFAULT 1,
  `TrabajoNormal`   TINYINT(1)   NOT NULL DEFAULT 1,
  `TrabajoExtra`    TINYINT(1)   NOT NULL DEFAULT 0,
  `AplicaCena`      TINYINT(1)   NOT NULL DEFAULT 0,
  `AplicaBono`      TINYINT(1)   NOT NULL DEFAULT 0,
  `Observaciones`   TEXT         NULL,
  `Elaboro`         VARCHAR(160) NULL,
  `Recibio`         VARCHAR(160) NULL,
  `Reviso`          VARCHAR(160) NULL,
  `Origen`          ENUM('MANUAL','PDF','EXCEL') NOT NULL DEFAULT 'MANUAL',
  `ArchivoOrigen`   VARCHAR(300) NULL,
  `Status`          ENUM('BORRADOR','CERRADO','COTIZADO','CANCELADO') NOT NULL DEFAULT 'BORRADOR',
  `IdUsuarioAlta`   INT UNSIGNED NULL,
  `FechaAlta`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaCambio`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdLevantamiento`),
  UNIQUE KEY `uq_folio` (`Folio`),
  KEY `idx_cliente_fecha` (`IdCliente`,`Fecha`),
  KEY `idx_status` (`Status`,`Fecha`),
  CONSTRAINT `fk_lev_cliente` FOREIGN KEY (`IdCliente`) REFERENCES `tblClientes` (`IdCliente`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblLevantamientoActividades` (
  `IdActividad`     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdLevantamiento` INT UNSIGNED NOT NULL,
  `Orden`           SMALLINT     NOT NULL DEFAULT 1,
  `Descripcion`     TEXT         NOT NULL,
  `Metros`          DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`IdActividad`),
  KEY `idx_lev` (`IdLevantamiento`,`Orden`),
  CONSTRAINT `fk_act_lev` FOREIGN KEY (`IdLevantamiento`)
    REFERENCES `tblLevantamientos` (`IdLevantamiento`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblLevantamientoPersonal` (
  `IdLevPersonal`   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdLevantamiento` INT UNSIGNED NOT NULL,
  `IdPuesto`        INT UNSIGNED NOT NULL,
  `Cantidad`        SMALLINT     NOT NULL DEFAULT 0,
  `TiempoExtra`     TINYINT(1)   NOT NULL DEFAULT 0,
  `Bono`            TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`IdLevPersonal`),
  UNIQUE KEY `uq_lev_puesto` (`IdLevantamiento`,`IdPuesto`),
  CONSTRAINT `fk_per_lev` FOREIGN KEY (`IdLevantamiento`)
    REFERENCES `tblLevantamientos` (`IdLevantamiento`) ON DELETE CASCADE,
  CONSTRAINT `fk_per_puesto` FOREIGN KEY (`IdPuesto`) REFERENCES `tblPuestos` (`IdPuesto`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblLevantamientoInsumos` (
  `IdLevInsumo`     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdLevantamiento` INT UNSIGNED NOT NULL,
  `IdInsumo`        INT UNSIGNED NULL COMMENT 'NULL cuando se capturó libre y aún no está en catálogo',
  `Descripcion`     VARCHAR(255) NOT NULL,
  `Cantidad`        DECIMAL(12,2) NOT NULL DEFAULT 0,
  `EsHerramental`   TINYINT(1)   NOT NULL DEFAULT 0,
  `Aplica`          TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0 = "NO APLICAR", lo pone el cliente',
  `Comentario`      VARCHAR(255) NULL,
  PRIMARY KEY (`IdLevInsumo`),
  KEY `idx_lev` (`IdLevantamiento`),
  CONSTRAINT `fk_lin_lev` FOREIGN KEY (`IdLevantamiento`)
    REFERENCES `tblLevantamientos` (`IdLevantamiento`) ON DELETE CASCADE,
  CONSTRAINT `fk_lin_insumo` FOREIGN KEY (`IdInsumo`) REFERENCES `tblInsumos` (`IdInsumo`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblLevantamientoEvidencias` (
  `IdEvidencia`     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdLevantamiento` INT UNSIGNED NOT NULL,
  `Archivo`         VARCHAR(300) NOT NULL,
  `Titulo`          VARCHAR(200) NULL,
  `Orden`           SMALLINT     NOT NULL DEFAULT 1,
  `FechaAlta`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdEvidencia`),
  KEY `idx_lev` (`IdLevantamiento`,`Orden`),
  CONSTRAINT `fk_evi_lev` FOREIGN KEY (`IdLevantamiento`)
    REFERENCES `tblLevantamientos` (`IdLevantamiento`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- COTIZACIÓN
-- =============================================================================

CREATE TABLE IF NOT EXISTS `tblCotizaciones` (
  `IdCotizacion`    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `NoCotizacion`    INT UNSIGNED NOT NULL COMMENT 'Consecutivo visible (6744)',
  `IdLevantamiento` INT UNSIGNED NULL,
  `IdCliente`       INT UNSIGNED NOT NULL,
  `IdVendedor`      INT UNSIGNED NULL,
  `Fecha`           DATE         NOT NULL,
  `Vigencia`        SMALLINT     NOT NULL DEFAULT 15 COMMENT 'Días de vigencia',
  `Descripcion`     VARCHAR(500) NOT NULL,
  `MetodoPrecio`    ENUM('TARIFA','MARGEN','MANUAL') NOT NULL DEFAULT 'MANUAL',
  `Subtotal`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `DescuentoPct`    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  `Descuento`       DECIMAL(14,2) NOT NULL DEFAULT 0,
  `IvaPct`          DECIMAL(5,2)  NOT NULL DEFAULT 16.00,
  `Iva`             DECIMAL(14,2) NOT NULL DEFAULT 0,
  `Total`           DECIMAL(14,2) NOT NULL DEFAULT 0,
  `Condiciones`     TEXT         NULL,
  `Status`          ENUM('BORRADOR','ENVIADA','AUTORIZADA','RECHAZADA','CANCELADA')
                    NOT NULL DEFAULT 'BORRADOR',
  `FechaEnvio`      DATETIME     NULL,
  `FechaAutoriza`   DATETIME     NULL,
  `AutorizadoPor`   VARCHAR(160) NULL COMMENT 'Ej. "AUTORIZA RODOLFO"',
  `MotivoRechazo`   VARCHAR(300) NULL,
  `IdUsuarioAlta`   INT UNSIGNED NULL,
  `FechaAlta`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaCambio`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdCotizacion`),
  UNIQUE KEY `uq_nocotizacion` (`NoCotizacion`),
  KEY `idx_cliente_fecha` (`IdCliente`,`Fecha`),
  KEY `idx_status` (`Status`,`Fecha`),
  CONSTRAINT `fk_cot_lev` FOREIGN KEY (`IdLevantamiento`)
    REFERENCES `tblLevantamientos` (`IdLevantamiento`),
  CONSTRAINT `fk_cot_cliente` FOREIGN KEY (`IdCliente`) REFERENCES `tblClientes` (`IdCliente`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblCotizacionPartidas` (
  `IdPartida`      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdCotizacion`   INT UNSIGNED NOT NULL,
  `Orden`          SMALLINT     NOT NULL DEFAULT 1,
  `Concepto`       TEXT         NOT NULL,
  `Unidad`         VARCHAR(30)  NOT NULL DEFAULT 'SERV',
  `Cantidad`       DECIMAL(12,2) NOT NULL DEFAULT 1,
  `PrecioUnitario` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `Importe`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`IdPartida`),
  KEY `idx_cot` (`IdCotizacion`,`Orden`),
  CONSTRAINT `fk_par_cot` FOREIGN KEY (`IdCotizacion`)
    REFERENCES `tblCotizaciones` (`IdCotizacion`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- COSTEO
-- =============================================================================

CREATE TABLE IF NOT EXISTS `tblCosteos` (
  `IdCosteo`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdCotizacion`       INT UNSIGNED NOT NULL,
  `IdLevantamiento`    INT UNSIGNED NULL,
  `Dias`               SMALLINT     NOT NULL DEFAULT 1,
  `Personal`           SMALLINT     NOT NULL DEFAULT 0,
  `PrecioVenta`        DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'Costo sin IVA autorizado',
  `Isr`                DECIMAL(14,2) NOT NULL DEFAULT 0,
  -- Porcentajes congelados al momento de crear el costeo
  `ImpuestosPct`       DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `AdministrativosPct` DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `FinanciamientoPct`  DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `ComisionPct`        DECIMAL(5,2) NOT NULL DEFAULT 4.00,
  -- Resultados del plan
  `GastoDirectoPlan`   DECIMAL(14,2) NOT NULL DEFAULT 0,
  `InsumosPlan`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `GastoTotalPlan`     DECIMAL(14,2) NOT NULL DEFAULT 0,
  `UtilidadBrutaPlan`  DECIMAL(14,2) NOT NULL DEFAULT 0,
  `ComisionPlan`       DECIMAL(14,2) NOT NULL DEFAULT 0,
  `UtilidadNetaPlan`   DECIMAL(14,2) NOT NULL DEFAULT 0,
  `MargenPlanPct`      DECIMAL(6,2)  NOT NULL DEFAULT 0,
  -- Resultados reales
  `GastoDirectoReal`   DECIMAL(14,2) NOT NULL DEFAULT 0,
  `InsumosReal`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `GastoTotalReal`     DECIMAL(14,2) NOT NULL DEFAULT 0,
  `UtilidadNetaReal`   DECIMAL(14,2) NOT NULL DEFAULT 0,
  `MargenRealPct`      DECIMAL(6,2)  NOT NULL DEFAULT 0,
  `Status`             ENUM('PLANEADO','EN_PROCESO','CERRADO') NOT NULL DEFAULT 'PLANEADO',
  `Comentario`         TEXT         NULL,
  `FechaAlta`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaCambio`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdCosteo`),
  UNIQUE KEY `uq_cotizacion` (`IdCotizacion`),
  KEY `idx_status` (`Status`),
  CONSTRAINT `fk_cos_cot` FOREIGN KEY (`IdCotizacion`)
    REFERENCES `tblCotizaciones` (`IdCotizacion`) ON DELETE CASCADE,
  CONSTRAINT `fk_cos_lev` FOREIGN KEY (`IdLevantamiento`)
    REFERENCES `tblLevantamientos` (`IdLevantamiento`)
) ENGINE=InnoDB;

-- Los nueve renglones de la tabla resumen del Excel (plan / real / diferencia).
CREATE TABLE IF NOT EXISTS `tblCosteoConceptos` (
  `IdCosteoConcepto` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdCosteo`         INT UNSIGNED NOT NULL,
  `Concepto`         ENUM('NOMINA','IMSS','BONOS','GASOLINA','DESGASTE',
                          'ADMINISTRATIVO','INSUMOS','EPP','EQUIPO') NOT NULL,
  `GastoPlan`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `GastoReal`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `Comentario`       VARCHAR(300) NULL,
  PRIMARY KEY (`IdCosteoConcepto`),
  UNIQUE KEY `uq_costeo_concepto` (`IdCosteo`,`Concepto`),
  CONSTRAINT `fk_con_cos` FOREIGN KEY (`IdCosteo`)
    REFERENCES `tblCosteos` (`IdCosteo`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Una sola matriz persona × día que reemplaza las hojas Nomina, Imss y Desgaste de Equipo.
CREATE TABLE IF NOT EXISTS `tblCosteoNomina` (
  `IdCosteoNomina` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdCosteo`       INT UNSIGNED NOT NULL,
  `IdEmpleado`     INT UNSIGNED NULL COMMENT 'NULL = plaza genérica "TÉCNICO 1"',
  `Nombre`         VARCHAR(160) NOT NULL,
  `IdPuesto`       INT UNSIGNED NOT NULL,
  `SalarioDiario`  DECIMAL(12,2) NOT NULL DEFAULT 0,
  `ImssDiario`     DECIMAL(12,2) NOT NULL DEFAULT 0,
  `DesgasteDiario` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `Bono`           DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`IdCosteoNomina`),
  KEY `idx_costeo` (`IdCosteo`),
  CONSTRAINT `fk_nom_cos` FOREIGN KEY (`IdCosteo`)
    REFERENCES `tblCosteos` (`IdCosteo`) ON DELETE CASCADE,
  CONSTRAINT `fk_nom_puesto` FOREIGN KEY (`IdPuesto`) REFERENCES `tblPuestos` (`IdPuesto`)
) ENGINE=InnoDB;

-- Asistencia por día: marcar el día genera nómina + IMSS + desgaste de esa persona.
CREATE TABLE IF NOT EXISTS `tblCosteoNominaDias` (
  `IdCosteoNominaDia` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdCosteoNomina`    BIGINT UNSIGNED NOT NULL,
  `Fecha`             DATE         NOT NULL,
  `Laborado`          TINYINT(1)   NOT NULL DEFAULT 1,
  `EsReal`            TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '0 = plan, 1 = confirmado en campo',
  PRIMARY KEY (`IdCosteoNominaDia`),
  UNIQUE KEY `uq_nomina_fecha` (`IdCosteoNomina`,`Fecha`),
  CONSTRAINT `fk_dia_nom` FOREIGN KEY (`IdCosteoNomina`)
    REFERENCES `tblCosteoNomina` (`IdCosteoNomina`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblCosteoInsumos` (
  `IdCosteoInsumo` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdCosteo`       INT UNSIGNED NOT NULL,
  `IdInsumo`       INT UNSIGNED NULL,
  `Descripcion`    VARCHAR(255) NOT NULL,
  `Unidades`       DECIMAL(12,2) NOT NULL DEFAULT 0,
  `CostoPlan`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `CostoReal`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `Fecha`          DATE         NULL,
  `Comentario`     VARCHAR(255) NULL COMMENT 'Ej. "NO APLICAR"',
  PRIMARY KEY (`IdCosteoInsumo`),
  KEY `idx_costeo` (`IdCosteo`),
  CONSTRAINT `fk_cins_cos` FOREIGN KEY (`IdCosteo`)
    REFERENCES `tblCosteos` (`IdCosteo`) ON DELETE CASCADE,
  CONSTRAINT `fk_cins_insumo` FOREIGN KEY (`IdInsumo`) REFERENCES `tblInsumos` (`IdInsumo`)
) ENGINE=InnoDB;

-- Gastos sueltos con fecha: gasolina (con ruta), administrativos, EPP, compra de equipo.
CREATE TABLE IF NOT EXISTS `tblCosteoGastos` (
  `IdCosteoGasto` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdCosteo`      INT UNSIGNED NOT NULL,
  `Concepto`      ENUM('GASOLINA','ADMINISTRATIVO','EPP','EQUIPO','OTRO') NOT NULL,
  `Fecha`         DATE         NULL,
  `Descripcion`   VARCHAR(255) NULL COMMENT 'Ruta, proveedor o detalle',
  `Cantidad`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `EsReal`        TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`IdCosteoGasto`),
  KEY `idx_costeo_concepto` (`IdCosteo`,`Concepto`),
  CONSTRAINT `fk_gas_cos` FOREIGN KEY (`IdCosteo`)
    REFERENCES `tblCosteos` (`IdCosteo`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- IMPORTACIÓN Y BITÁCORA
-- =============================================================================

CREATE TABLE IF NOT EXISTS `tblImportaciones` (
  `IdImportacion`   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Archivo`         VARCHAR(300) NOT NULL,
  `Tipo`            ENUM('PDF','EXCEL') NOT NULL,
  `Metodo`          ENUM('PLANTILLA','IA') NOT NULL DEFAULT 'PLANTILLA',
  `Estado`          ENUM('PENDIENTE','REVISION','APLICADA','ERROR') NOT NULL DEFAULT 'PENDIENTE',
  `JsonExtraido`    LONGTEXT     NULL,
  `IdLevantamiento` INT UNSIGNED NULL,
  `IdCosteo`        INT UNSIGNED NULL,
  `Mensaje`         VARCHAR(500) NULL,
  `IdUsuario`       INT UNSIGNED NULL,
  `FechaAlta`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdImportacion`),
  KEY `idx_estado` (`Estado`,`FechaAlta`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tblBitacora` (
  `IdBitacora` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `IdUsuario`  INT UNSIGNED NULL,
  `Entidad`    VARCHAR(40)  NOT NULL COMMENT 'LEVANTAMIENTO, COTIZACION, COSTEO...',
  `IdEntidad`  INT UNSIGNED NULL,
  `Accion`     VARCHAR(40)  NOT NULL,
  `Detalle`    TEXT         NULL,
  `FechaAlta`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IdBitacora`),
  KEY `idx_entidad` (`Entidad`,`IdEntidad`,`FechaAlta`)
) ENGINE=InnoDB;

-- =============================================================================
-- SEMILLA — valores tomados de los proyectos 6744 y 6745
-- =============================================================================

INSERT IGNORE INTO `tblParametros` (`Clave`,`Valor`,`Descripcion`) VALUES
  ('IMPUESTOS_PCT',        10.0000, 'Impuestos sobre el gasto directo'),
  ('ADMINISTRATIVOS_PCT',   5.0000, 'Administrativos (5 / 10 / 15 %)'),
  ('FINANCIAMIENTO_PCT',    5.0000, 'Financiamiento sobre el subtotal con insumos'),
  ('COMISION_PCT',          4.0000, 'Comisión del vendedor sobre la utilidad bruta'),
  ('ISR_FIJO',           1000.0000, 'ISR fijo por proyecto'),
  ('IVA_PCT',              16.0000, 'IVA'),
  ('MARGEN_OBJETIVO_PCT',  50.0000, 'Margen objetivo para el precio sugerido'),
  ('MARGEN_ALERTA_PCT',    30.0000, 'Debajo de este margen el semáforo se pone en rojo');

INSERT IGNORE INTO `tblPuestos`
  (`Puesto`,`Abreviatura`,`SalarioDiario`,`ImssDiario`,`DesgasteDiario`,`BonoDefault`,`TarifaVentaDia`,`Orden`) VALUES
  ('TÉCNICO EN ALTURA','TÉCNICO',   700.00, 51.30, 100.00, 800.00, 4200.00, 1),
  ('SUPERVISOR',       'SUPERV.',   900.00, 51.30, 100.00, 800.00, 4800.00, 2),
  ('AYUDANTE',         'AYUD.',     500.00, 51.30,   0.00,   0.00, 2500.00, 3),
  ('SUPERVISOR DE SEGURIDAD','SUP SEG', 800.00, 51.30, 100.00, 800.00, 4200.00, 4),
  ('VIGÍA',            'VIGÍA',     600.00, 51.30,   0.00, 800.00, 3000.00, 5);

INSERT IGNORE INTO `tblTarifasMonto` (`Tipo`,`MontoHasta`,`Costo`) VALUES
  ('EPP',     25000.00,  1000.00), ('EPP',     50000.00,  2000.00),
  ('EPP',     75000.00,  3000.00), ('EPP',    100000.00,  5000.00),
  ('EPP',    150000.00,  6500.00), ('EPP',    200000.00,  8000.00),
  ('EPP',    300000.00, 10000.00), ('EPP',    400000.00, 12500.00),
  ('EPP',   5000000.00, 14000.00),
  ('EQUIPO',  25000.00,  1000.00), ('EQUIPO',  50000.00,  2000.00),
  ('EQUIPO',  75000.00,  3000.00), ('EQUIPO', 100000.00,  5000.00),
  ('EQUIPO', 150000.00,  6500.00), ('EQUIPO', 200000.00,  8000.00),
  ('EQUIPO', 300000.00, 10000.00), ('EQUIPO', 400000.00, 12500.00),
  ('EQUIPO',5000000.00, 14000.00);
