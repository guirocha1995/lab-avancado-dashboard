-- ============================================================
-- Lab Avançado — Retail Operations Dashboard
-- SQL Server Schema Initialization
-- ============================================================

-- Products table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
BEGIN
    CREATE TABLE Products (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500),
        Price DECIMAL(10,2) NOT NULL,
        Category NVARCHAR(50),
        Stock INT NOT NULL DEFAULT 0,
        ImageUrl NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
END;

-- Orders table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Orders')
BEGIN
    CREATE TABLE Orders (
        Id NVARCHAR(36) PRIMARY KEY,
        CustomerName NVARCHAR(100) NOT NULL,
        TotalAmount DECIMAL(10,2) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
END;

-- OrderItems table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OrderItems')
BEGIN
    CREATE TABLE OrderItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        OrderId NVARCHAR(36) NOT NULL REFERENCES Orders(Id),
        ProductId INT NOT NULL REFERENCES Products(Id),
        ProductName NVARCHAR(100) NOT NULL,
        Quantity INT NOT NULL,
        UnitPrice DECIMAL(10,2) NOT NULL
    );
END;

-- EventLog table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventLog')
BEGIN
    CREATE TABLE EventLog (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EventType NVARCHAR(50) NOT NULL,
        Source NVARCHAR(50) NOT NULL,
        Payload NVARCHAR(MAX),
        OrderId NVARCHAR(36) NULL,
        Severity NVARCHAR(10) DEFAULT 'info',
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
END;

-- Metrics table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Metrics')
BEGIN
    CREATE TABLE Metrics (
        Id INT PRIMARY KEY IDENTITY(1,1),
        MetricName NVARCHAR(50) NOT NULL,
        MetricValue DECIMAL(18,2) NOT NULL,
        Tags NVARCHAR(500),
        RecordedAt DATETIME2 DEFAULT GETUTCDATE()
    );
END;

-- ============================================================
-- Seed Products (12 Brazilian retail items)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM Products)
BEGIN
    INSERT INTO Products (Name, Description, Price, Category, Stock, ImageUrl) VALUES
    (N'Camiseta Polo Premium',
     N'Camiseta polo masculina em algodão pima com bordado no peito. Disponível em várias cores.',
     129.90, N'Vestuário', 85,
     N'https://via.placeholder.com/300x300?text=Camiseta+Polo'),

    (N'Calça Jeans Slim',
     N'Calça jeans masculina corte slim com elastano para maior conforto. Lavagem média.',
     189.90, N'Vestuário', 60,
     N'https://via.placeholder.com/300x300?text=Calca+Jeans'),

    (N'Tênis Running Pro',
     N'Tênis de corrida com tecnologia de amortecimento e solado em borracha antiderrapante.',
     349.90, N'Calçados', 45,
     N'https://via.placeholder.com/300x300?text=Tenis+Running'),

    (N'Mochila Urban',
     N'Mochila urbana com compartimento para notebook 15", bolso frontal e alças acolchoadas.',
     159.90, N'Acessórios', 120,
     N'https://via.placeholder.com/300x300?text=Mochila+Urban'),

    (N'Relógio Digital Smart',
     N'Relógio digital com monitor cardíaco, GPS integrado e resistência à água 5ATM.',
     499.90, N'Acessórios', 30,
     N'https://via.placeholder.com/300x300?text=Relogio+Smart'),

    (N'Óculos de Sol Classic',
     N'Óculos de sol com lentes polarizadas UV400 e armação em acetato italiano.',
     249.90, N'Acessórios', 75,
     N'https://via.placeholder.com/300x300?text=Oculos+Sol'),

    (N'Jaqueta Corta-Vento',
     N'Jaqueta corta-vento impermeável com capuz retrátil e bolsos laterais com zíper.',
     279.90, N'Vestuário', 40,
     N'https://via.placeholder.com/300x300?text=Jaqueta+Corta+Vento'),

    (N'Boné Esportivo',
     N'Boné esportivo com ajuste traseiro em velcro e tecido dry-fit para maior ventilação.',
     59.90, N'Acessórios', 150,
     N'https://via.placeholder.com/300x300?text=Bone+Esportivo'),

    (N'Carteira Couro Legítimo',
     N'Carteira masculina em couro legítimo com porta-cartões, porta-moedas e divisórias.',
     139.90, N'Acessórios', 90,
     N'https://via.placeholder.com/300x300?text=Carteira+Couro'),

    (N'Cinto Social',
     N'Cinto social em couro com fivela metálica prateada. Ajustável.',
     89.90, N'Acessórios', 110,
     N'https://via.placeholder.com/300x300?text=Cinto+Social'),

    (N'Meias Esportivas (Pack 3)',
     N'Kit com 3 pares de meias esportivas em algodão com reforço no calcanhar e biqueira.',
     29.90, N'Vestuário', 5,
     N'https://via.placeholder.com/300x300?text=Meias+Esportivas'),

    (N'Bermuda Cargo',
     N'Bermuda cargo masculina com bolsos laterais e cós com elástico interno.',
     119.90, N'Vestuário', 70,
     N'https://via.placeholder.com/300x300?text=Bermuda+Cargo');
END;

-- ============================================================
-- Stored Procedure: sp_GetDashboardMetrics
-- ============================================================

IF OBJECT_ID('sp_GetDashboardMetrics', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetDashboardMetrics;
GO

CREATE PROCEDURE sp_GetDashboardMetrics
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM Orders) AS TotalOrders,
        (SELECT ISNULL(SUM(TotalAmount), 0) FROM Orders) AS TotalRevenue,
        (SELECT COUNT(*) FROM Orders WHERE Status = 'pending') AS PendingOrders,
        (SELECT COUNT(*) FROM Products WHERE Stock < 10) AS LowStockCount,
        (SELECT COUNT(*) FROM EventLog WHERE CreatedAt >= DATEADD(HOUR, -1, GETUTCDATE())) AS EventsLastHour,
        (SELECT ISNULL(AVG(DATEDIFF(SECOND, o.CreatedAt, o.UpdatedAt)), 0)
         FROM Orders o
         WHERE o.Status NOT IN ('pending')
           AND o.UpdatedAt > o.CreatedAt) AS AvgProcessingTimeSeconds;
END;
GO
