from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
required = [
    'ERB.sln', 'README.md', 'IMPLEMENTATION_STATUS.md',
    'src/Erb.Desktop/Erb.Desktop.csproj',
    'src/Erb.Desktop/App.config',
    'src/Erb.Desktop/packages.config',
    'src/Erb.Desktop/Database/001_initial.sql',
    'src/Erb.Desktop/Infrastructure/Database.cs',
    'src/Erb.Desktop/Domain/StockMovementService.cs',
    'src/Erb.Desktop/MainForm.cs',
]
for relative in required:
    path = root / relative
    assert path.exists() and path.stat().st_size > 0, f'missing or empty: {relative}'
for relative in ['src/Erb.Desktop/Erb.Desktop.csproj', 'src/Erb.Desktop/App.config', 'src/Erb.Desktop/packages.config']:
    ET.parse(root / relative)
cs = list((root / 'src').rglob('*.cs'))
for path in cs:
    text = path.read_text(encoding='utf-8')
    assert text.count('{') == text.count('}'), f'unbalanced braces: {path}'
project = (root / 'src/Erb.Desktop/Erb.Desktop.csproj').read_text(encoding='utf-8')
assert project.count('Microsoft.CSharp.targets') == 1
assert 'TargetFrameworkVersion>v4.8' in project
assert '<Prefer32Bit>true</Prefer32Bit>' in project
print(f'project_files={len(required)}')
print(f'csharp_files={len(cs)}')
print('xml_and_project_structure=OK')
