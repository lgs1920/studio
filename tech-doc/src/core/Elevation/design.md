Il faut une configuration deserveurs avec ue URL  
Prendre en comptelfait d'avoir dsconfiguartiondeonnée différentes.
Prendre en compte d'avoir des nombres de données max et donc y aller page par page


API : 
- ElevationOpe API : https://api.open-elevation.com/api/v1/lookup?locations=45.33524,5.70291
- IGN :https://wxs.ign.fr/calcul/alti/rest/elevation.json?lon=5.70291&lat=45.33524

## Use cases

### 1 File has been read with no altitude data and No elevation server

The list is :
- No Elevation Data  --> none
- Servers list  --> server-id

### 2 No elevation server but elevation data

The list is : 
- Remove Current Elevation Data --> clear
- Use File Elevation Data // only if provided else it is UC 1 --> undefined
- Servers List --> server-id

### 3 Elevation server exists but not **none**

The list is :
- Remove Current Elevation Data  --> clear
- Use File Elevation Data  --> undefined
- Servers List --> server-id




