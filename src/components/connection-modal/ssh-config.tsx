import { Input } from "../ui/input"
import { Label } from "../ui/label"

interface SshConfigProps {
  enabled: boolean
  sshHost: string
  sshPort: string
  sshUser: string
  sshPassword: string
  sshKeyPath: string
  onEnabledChange: (enabled: boolean) => void
  onSshHostChange: (value: string) => void
  onSshPortChange: (value: string) => void
  onSshUserChange: (value: string) => void
  onSshPasswordChange: (value: string) => void
  onSshKeyPathChange: (value: string) => void
}

export function SshConfig({
  enabled,
  sshHost,
  sshPort,
  sshUser,
  sshPassword,
  sshKeyPath,
  onEnabledChange,
  onSshHostChange,
  onSshPortChange,
  onSshUserChange,
  onSshPasswordChange,
  onSshKeyPathChange,
}: SshConfigProps) {
  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="sshEnabled"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-input"
        />
        <Label htmlFor="sshEnabled" className="font-mono text-xs text-foreground cursor-pointer">
          SSH Tunnel
        </Label>
      </div>
      {enabled && (
        <div className="space-y-3 rounded-lg border border-border/50 p-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sshHost" className="font-mono text-[11px] text-muted-foreground">SSH Host</Label>
              <Input
                id="sshHost"
                value={sshHost}
                onChange={(e) => onSshHostChange(e.target.value)}
                placeholder="bastion.example.com"
                className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sshPort" className="font-mono text-[11px] text-muted-foreground">SSH Port</Label>
              <Input
                id="sshPort"
                value={sshPort}
                onChange={(e) => onSshPortChange(e.target.value)}
                placeholder="22"
                className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sshUser" className="font-mono text-[11px] text-muted-foreground">SSH User</Label>
            <Input
              id="sshUser"
              value={sshUser}
              onChange={(e) => onSshUserChange(e.target.value)}
              placeholder="ubuntu"
              className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sshPassword" className="font-mono text-[11px] text-muted-foreground">SSH Password</Label>
            <Input
              id="sshPassword"
              type="password"
              value={sshPassword}
              onChange={(e) => onSshPasswordChange(e.target.value)}
              placeholder="••••••••"
              className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sshKeyPath" className="font-mono text-[11px] text-muted-foreground">Private Key Path</Label>
            <Input
              id="sshKeyPath"
              value={sshKeyPath}
              onChange={(e) => onSshKeyPathChange(e.target.value)}
              placeholder="~/.ssh/id_rsa"
              className="bg-input/80 border-border/50 text-foreground font-mono text-sm rounded-lg h-8"
            />
          </div>
        </div>
      )}
    </div>
  )
}
