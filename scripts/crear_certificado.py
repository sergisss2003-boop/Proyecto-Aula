"""Crea el certificado HTTPS de desarrollo en certs/ (cert.pem y key.pem).

- Si mkcert está instalado, lo usa: el navegador confía en el certificado y muestra el candado sin avisos.
- Si no, crea un certificado autofirmado: funciona igual, pero el navegador mostrará una advertencia
  la primera vez (es lo esperado con un certificado autofirmado).

Uso:  npm run certificado
La carpeta certs/ está en .gitignore: la clave privada NUNCA se sube al repositorio.
"""
import datetime
import ipaddress
import shutil
import subprocess
from pathlib import Path

CARPETA = Path(__file__).resolve().parent.parent / 'certs'
CERT, CLAVE = CARPETA / 'cert.pem', CARPETA / 'key.pem'
NOMBRES = ['localhost', '127.0.0.1']


def con_mkcert():
    subprocess.run(['mkcert', '-install'], check=True)
    subprocess.run(['mkcert', '-key-file', str(CLAVE), '-cert-file', str(CERT), *NOMBRES], check=True)


def autofirmado():
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    clave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    nombre = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost'),
                        x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'Studio SD (desarrollo)')])
    ahora = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(nombre).issuer_name(nombre)
        .public_key(clave.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(ahora)
        .not_valid_after(ahora + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName([
            x509.DNSName('localhost'), x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(clave, hashes.SHA256())
    )
    CLAVE.write_bytes(clave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                                          serialization.NoEncryption()))
    CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


if __name__ == '__main__':
    CARPETA.mkdir(exist_ok=True)
    if shutil.which('mkcert'):
        print('Usando mkcert (certificado de confianza)...')
        con_mkcert()
    else:
        print('mkcert no está instalado: creando un certificado autofirmado (válido 365 días)...')
        autofirmado()
    print(f'Listo:\n  {CERT}\n  {CLAVE}')
