# Kiellettyjen merkkijonojen vahti

Patch-ohjeiden tarkistusvaiheet (`grep ... -f "$SERVALO_KIELLETYT"`) etsivät
tiedostoista merkkijonoja, jotka eivät saa päätyä sovellukseen (esim. malliaineistojen
henkilö-, yritys- ja yhteystiedot).

Itse merkkijonoja **ei tallenneta repoon**. Ne pidetään paikallisessa tiedostossa,
yksi ERE-lauseke riviä kohden, ja tiedoston polku annetaan ympäristömuuttujassa:

```bash
export SERVALO_KIELLETYT="$HOME/.config/servalo/kielletyt.txt"
```

Jos muuttujaa ei ole asetettu, tarkistus pysähtyy virheeseen eikä hyväksy muutosta
huomaamatta. Tiedostonimi `kielletyt.txt` on lisätty `.gitignore`-tiedostoon, jotta
listaa ei vahingossa lisätä repoon.
