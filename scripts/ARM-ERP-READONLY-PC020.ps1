# READ-ONLY: PC020 -> linked PC005 DB_ST. Never performs SQL writes or prints credentials.
$ErrorActionPreference="Stop"
$cn=New-Object System.Data.SqlClient.SqlConnection(
 'Server=localhost;Database=DB_ST;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=7;Application Name=ARM-CRM-READONLY-PROBE')
try {
 $cn.Open()
 $cmd=$cn.CreateCommand()
 $cmd.CommandTimeout=20
 $cmd.CommandText=@"
SELECT PARTNUMBER,STOCK_FINAL,FECHA_PROCESO
FROM [PC005].[DB_ST].[dbo].[ST_STOCK_HST_CONSULTA]
WHERE PARTNUMBER IN (@p0,@p1,@p2,@p3)
"@
 @('ARMOR-22-256GB','ARMOR-25TPro-256GB','ARMOR-X12Pro','ARMOR-X13') |
 ForEach-Object -Begin {$i=0} -Process {
   $p=$cmd.Parameters.Add("@p"+$i,[System.Data.SqlDbType]::NVarChar,80)
   $p.Value=$_
   $i++
 }
 $reader=$cmd.ExecuteReader()
 $rows=[System.Collections.Generic.List[object]]::new()
 while($reader.Read()) {
   $pn=[string]$reader["PARTNUMBER"]
   $stock=if($reader.IsDBNull($reader.GetOrdinal("STOCK_FINAL"))){$null}else{[int]$reader["STOCK_FINAL"]}
   $source=[datetime]$reader["FECHA_PROCESO"]
   $rows.Add([pscustomobject]@{
     partnumber=$pn
     physical_units=$stock
     source_updated_at=($source.ToString('yyyy-MM-ddTHH:mm:ss')+'-05:00')
   })
 }
 $reader.Close()
 $json=ConvertTo-Json -InputObject @($rows.ToArray()) -Depth 3 -Compress
 Write-Output $json
}finally{
 if($cn.State -ne 'Closed'){$cn.Close()}
 $cn.Dispose()
}
