import { NextRequest, NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Store the running process
let agentProcess: ChildProcess | null = null
let processStartTime: number | null = null

// PID file location
const PID_FILE = path.join(process.cwd(), '..', '.imessage-agent.pid')

/**
 * GET /api/imessage - Get iMessage agent status
 */
export async function GET() {
    try {
        const isRunning = agentProcess !== null && !agentProcess.killed
        const uptime = processStartTime ? Date.now() - processStartTime : 0
        
        return NextResponse.json({
            status: isRunning ? 'running' : 'stopped',
            uptime,
            pid: agentProcess?.pid || null
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to get status', details: error.message },
            { status: 500 }
        )
    }
}

/**
 * POST /api/imessage - Start or stop the iMessage agent
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action } = body

        if (action === 'start') {
            return await startAgent()
        } else if (action === 'stop') {
            return await stopAgent()
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "start" or "stop"' },
                { status: 400 }
            )
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to control agent', details: error.message },
            { status: 500 }
        )
    }
}

async function startAgent() {
    // Check if already running
    if (agentProcess !== null && !agentProcess.killed) {
        return NextResponse.json({
            message: 'Agent is already running',
            status: 'running',
            pid: agentProcess.pid
        })
    }

    try {
        // Path to the agent script (one level up from dashboard)
        const agentPath = path.join(process.cwd(), '..', 'support-agent.ts')
        
        // Start the agent process
        agentProcess = spawn('bun', ['run', agentPath], {
            cwd: path.join(process.cwd(), '..'),
            env: {
                ...process.env,
                // Ensure the agent runs in production mode
                NODE_ENV: 'production'
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        })

        processStartTime = Date.now()

        // Log output for debugging
        agentProcess.stdout?.on('data', (data) => {
            console.log(`[iMessage Agent] ${data.toString()}`)
        })

        agentProcess.stderr?.on('data', (data) => {
            console.error(`[iMessage Agent Error] ${data.toString()}`)
        })

        agentProcess.on('exit', (code) => {
            console.log(`[iMessage Agent] Process exited with code ${code}`)
            agentProcess = null
            processStartTime = null
            // Clean up PID file
            try {
                if (existsSync(PID_FILE)) {
                    require('fs').unlinkSync(PID_FILE)
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        })

        // Save PID to file for external monitoring
        if (agentProcess.pid) {
            await writeFile(PID_FILE, agentProcess.pid.toString())
        }

        return NextResponse.json({
            message: 'iMessage agent started successfully',
            status: 'running',
            pid: agentProcess.pid
        })
    } catch (error: any) {
        agentProcess = null
        processStartTime = null
        return NextResponse.json(
            { error: 'Failed to start agent', details: error.message },
            { status: 500 }
        )
    }
}

async function stopAgent() {
    if (!agentProcess || agentProcess.killed) {
        return NextResponse.json({
            message: 'Agent is not running',
            status: 'stopped'
        })
    }

    try {
        // Send termination signal
        agentProcess.kill('SIGTERM')
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Force kill if still running
        if (agentProcess && !agentProcess.killed) {
            agentProcess.kill('SIGKILL')
        }

        agentProcess = null
        processStartTime = null

        // Clean up PID file
        try {
            if (existsSync(PID_FILE)) {
                require('fs').unlinkSync(PID_FILE)
            }
        } catch (e) {
            // Ignore cleanup errors
        }

        return NextResponse.json({
            message: 'iMessage agent stopped successfully',
            status: 'stopped'
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to stop agent', details: error.message },
            { status: 500 }
        )
    }
}
